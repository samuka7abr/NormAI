import asyncio
import json
import logging
from typing import TypeVar

from openai import APIConnectionError, APIError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ValidationError
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from domain.shared.llm_client import LLMClient, LLMError, LLMMessage
from infrastructure.settings import Settings

T = TypeVar("T", bound=BaseModel)

logger = logging.getLogger(__name__)

_RETRYABLE = (APIConnectionError, APITimeoutError, RateLimitError, APIError)


class OpenAICompatibleClient(LLMClient):
    """Cliente único pra qualquer endpoint compatível com OpenAI.

    Funciona com Ollama (dev), Groq, Together, Fireworks, OpenRouter e o próprio
    OpenAI. A escolha do provedor é feita por env vars (base_url, api_key, model).
    """

    def __init__(self, settings: Settings) -> None:
        self._model = settings.llm_model
        self._timeout = settings.llm_timeout_s
        self._max_retries = settings.llm_max_retries
        self._client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            timeout=settings.llm_timeout_s,
            max_retries=0,  # retry é controlado por tenacity, não pelo SDK
        )
        self._semaphore = asyncio.Semaphore(settings.llm_max_concurrency)

    async def chat_structured(
        self,
        messages: list[LLMMessage],
        schema: type[T],
        *,
        temperature: float = 0.0,
    ) -> T:
        payload = [{"role": m.role, "content": m.content} for m in messages]
        json_schema = _to_json_schema(schema)

        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self._max_retries),
                wait=wait_exponential(multiplier=1, min=1, max=15),
                retry=retry_if_exception_type(_RETRYABLE),
                reraise=True,
            ):
                with attempt:
                    async with self._semaphore:
                        completion = await self._client.chat.completions.create(
                            model=self._model,
                            messages=payload,  # type: ignore[arg-type]
                            temperature=temperature,
                            response_format={
                                "type": "json_schema",
                                "json_schema": {
                                    "name": schema.__name__,
                                    "schema": json_schema,
                                    "strict": True,
                                },
                            },
                        )
        except RetryError as exc:
            raise LLMError("LLM provider exhausted retries") from exc
        except _RETRYABLE as exc:
            raise LLMError(str(exc)) from exc

        content = completion.choices[0].message.content or ""
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            logger.warning("LLM returned non-JSON content: %s", content[:200])
            raise LLMError("LLM returned invalid JSON") from exc

        try:
            return schema.model_validate(data)
        except ValidationError as exc:
            logger.warning("LLM JSON does not match schema %s: %s", schema.__name__, exc)
            raise LLMError(f"LLM response failed schema validation: {exc}") from exc


def _to_json_schema(schema: type[BaseModel]) -> dict:
    """Converte um modelo Pydantic em JSON Schema compatível com structured outputs.

    Provedores como Groq e OpenAI exigem `additionalProperties: false` em todos
    os objetos e `required` listando todas as keys. Ajustamos recursivamente.
    """
    raw = schema.model_json_schema()
    _strictify(raw)
    return raw


def _strictify(node: object) -> None:
    if isinstance(node, dict):
        if node.get("type") == "object":
            properties = node.get("properties")
            if isinstance(properties, dict):
                node["additionalProperties"] = False
                node["required"] = list(properties.keys())
        for value in node.values():
            _strictify(value)
    elif isinstance(node, list):
        for item in node:
            _strictify(item)
