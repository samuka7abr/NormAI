import pytest

from application.auth.dtos import RefreshSessionCommand, RegisterUserCommand
from application.auth.refresh_session import RefreshSessionUseCase
from application.auth.register_user import RegisterUserUseCase
from domain.auth.exceptions import (
    RefreshTokenExpired,
    RefreshTokenNotFound,
    RefreshTokenRevoked,
)

from tests.unit.application._helpers import (
    FakePasswordHasher,
    FakeRefreshTokenRepository,
    FakeTokenService,
    FakeUserRepository,
    make_expired_refresh,
)


def build():
    user_repo = FakeUserRepository()
    refresh_repo = FakeRefreshTokenRepository()
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    register = RegisterUserUseCase(user_repo, refresh_repo, hasher, tokens)
    refresh = RefreshSessionUseCase(user_repo, refresh_repo, tokens)
    return register, refresh, refresh_repo, tokens


async def test_refresh_success_rotates_tokens():
    register, refresh, refresh_repo, tokens = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )
    old_refresh = session.refresh_token

    new_session = await refresh.execute(RefreshSessionCommand(refresh_token=old_refresh))

    assert new_session.refresh_token != old_refresh
    assert new_session.access_token != session.access_token

    old_hash = tokens.hash_refresh_token(old_refresh)
    stored_old = await refresh_repo.find_by_hash(old_hash)
    assert stored_old.is_revoked()


async def test_refresh_with_unknown_token_raises():
    _, refresh, _, _ = build()

    with pytest.raises(RefreshTokenNotFound):
        await refresh.execute(RefreshSessionCommand(refresh_token="inexistente"))


async def test_refresh_with_revoked_token_raises():
    register, refresh, _, _ = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    await refresh.execute(RefreshSessionCommand(refresh_token=session.refresh_token))

    with pytest.raises(RefreshTokenRevoked):
        await refresh.execute(RefreshSessionCommand(refresh_token=session.refresh_token))


async def test_refresh_with_expired_token_raises():
    register, refresh, refresh_repo, tokens = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    token_hash = tokens.hash_refresh_token(session.refresh_token)
    expired = make_expired_refresh(
        user_id=(await refresh_repo.find_by_hash(token_hash)).user_id,
        token_hash=token_hash,
    )
    await refresh_repo.save(expired)

    with pytest.raises(RefreshTokenExpired):
        await refresh.execute(RefreshSessionCommand(refresh_token=session.refresh_token))
