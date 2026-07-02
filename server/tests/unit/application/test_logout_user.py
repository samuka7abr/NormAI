from application.auth.dtos import LogoutUserCommand, RegisterUserCommand
from application.auth.logout_user import LogoutUserUseCase
from application.auth.register_user import RegisterUserUseCase

from tests.unit.application._helpers import (
    FakePasswordHasher,
    FakeRefreshTokenRepository,
    FakeTokenService,
    FakeUserRepository,
)


def build():
    user_repo = FakeUserRepository()
    refresh_repo = FakeRefreshTokenRepository()
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    register = RegisterUserUseCase(user_repo, refresh_repo, hasher, tokens)
    logout = LogoutUserUseCase(refresh_repo, tokens)
    return register, logout, refresh_repo, tokens


async def test_logout_revokes_refresh_token():
    register, logout, refresh_repo, tokens = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    await logout.execute(LogoutUserCommand(refresh_token=session.refresh_token))

    token_hash = tokens.hash_refresh_token(session.refresh_token)
    stored = await refresh_repo.find_by_hash(token_hash)
    assert stored.is_revoked()


async def test_logout_without_token_does_not_raise():
    _, logout, _, _ = build()
    await logout.execute(LogoutUserCommand(refresh_token=None))


async def test_logout_with_unknown_token_does_not_raise():
    _, logout, _, _ = build()
    await logout.execute(LogoutUserCommand(refresh_token="nao-existe"))


async def test_logout_is_idempotent():
    register, logout, _, _ = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    await logout.execute(LogoutUserCommand(refresh_token=session.refresh_token))
    await logout.execute(LogoutUserCommand(refresh_token=session.refresh_token))
