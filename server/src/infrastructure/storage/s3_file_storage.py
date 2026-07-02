from collections.abc import AsyncIterator
from typing import Any

import aioboto3

from domain.shared.file_storage import FileStorage
from infrastructure.settings import Settings

# Em desenvolvimento usamos LocalStack como servidor S3 local (docker-compose).
# AWS_S3_ENDPOINT_URL=http://localstack:4566      → endpoint interno usado pela API
# AWS_S3_PUBLIC_ENDPOINT_URL=http://localhost:4566 → endpoint que o browser acessa
# Em produção ambas ficam vazias e a AWS real é utilizada.


class S3FileStorage(FileStorage):
    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.aws_s3_bucket_name
        self._region = settings.aws_s3_region
        self._session = aioboto3.Session(
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_s3_region,
        )
        self._endpoint_url: str | None = settings.aws_s3_endpoint_url or None
        self._public_endpoint_url: str | None = settings.aws_s3_public_endpoint_url or self._endpoint_url
        self._using_localstack = self._endpoint_url is not None

    def _client(self, endpoint_url: str | None = None) -> Any:
        from botocore.config import Config
        kwargs: dict[str, Any] = {"endpoint_url": endpoint_url if endpoint_url is not None else self._endpoint_url}
        if self._using_localstack:
            kwargs["config"] = Config(signature_version="s3v4", s3={"addressing_style": "path"})
        return self._session.client("s3", **kwargs)

    async def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        async with self._client() as s3:
            await s3.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        return key

    async def load_stream(self, key: str) -> AsyncIterator[bytes]:
        async with self._client() as s3:
            response = await s3.get_object(Bucket=self._bucket, Key=key)
            body = response["Body"]

            if hasattr(body, "iter_chunks"):
                async for chunk in body.iter_chunks(chunk_size=65536):
                    yield chunk
                return

            if hasattr(body, "content") and hasattr(body.content, "iter_chunked"):
                async for chunk in body.content.iter_chunked(65536):
                    yield chunk
                return

            while True:
                chunk = await body.read(65536)
                if not chunk:
                    break
                yield chunk

    async def delete(self, key: str) -> None:
        async with self._client() as s3:
            await s3.delete_object(Bucket=self._bucket, Key=key)

    async def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        # Usa o endpoint público para que a URL gerada seja acessível pelo browser
        async with self._client(endpoint_url=self._public_endpoint_url) as s3:
            return await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )
