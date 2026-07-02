from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Normalizador JusBrasil"
    app_env: str = "development"
    app_version: str = "0.1.0"

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    #CORS -> origens permitidas
    cors_allowed_origins: list[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ]
    # Postgres
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/normalizador"

    # Upload
    max_upload_size_mb: int = 30

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket_name: str = ""
    aws_s3_region: str = "us-east-1"
    aws_s3_endpoint_url: str = ""        # endpoint interno (Docker): http://localstack:4566
    aws_s3_public_endpoint_url: str = "" # endpoint público (browser): http://localhost:4566

    # LLM
    # Dev: Ollama local (http://ollama:11434/v1, api_key="ollama", model="llama3.1:8b").
    # Prod: Groq/Together/Fireworks/OpenRouter (qualquer endpoint compatível com OpenAI).
    llm_base_url: str = "http://ollama:11434/v1"
    llm_api_key: str = "ollama"
    llm_model: str = "llama3.1:8b"
    llm_timeout_s: float = 60.0
    llm_max_retries: int = 3
    llm_max_concurrency: int = 8
    llm_sample_size: int = 300  # nº de valores únicos enviados na descoberta de categorias
    llm_batch_size: int = 50  # nº de valores por chamada de classificação

    # Celery + Redis
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"
    celery_task_default_queue: str = "normalizador"
    celery_worker_max_retries: int = 3
    celery_worker_retry_countdown_s: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
