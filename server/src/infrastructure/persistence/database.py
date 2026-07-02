import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from infrastructure.settings import get_settings

_settings = get_settings()

_engine_kwargs = (
    {"poolclass": NullPool}
    if os.getenv("TESTING") == "1" or os.getenv("CELERY_WORKER") == "1"
    else {"pool_pre_ping": True}
)

engine = create_async_engine(
    _settings.database_url,
    echo=_settings.app_env == "development",
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
