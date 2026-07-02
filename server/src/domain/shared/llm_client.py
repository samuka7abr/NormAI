from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


@dataclass
class LLMMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


class LLMClient(ABC):
    @abstractmethod
    async def chat_structured(
        self,
        messages: list[LLMMessage],
        schema: type[T],
        *,
        temperature: float = 0.0,
    ) -> T:
        """Envia o histórico de mensagens e força a resposta no formato do schema Pydantic.

        Implementação concreta deve garantir retry e timeout. Levanta LLMError
        em falhas irrecuperáveis.
        """


class LLMError(Exception):
    """Falha irrecuperável na chamada ao provedor de LLM."""
