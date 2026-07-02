import pytest

from application.auth.dtos import LoginUserCommand, RegisterUserCommand
from application.auth.login_user import LoginUserUseCase
from application.auth.register_user import RegisterUserUseCase
from domain.auth.exceptions import InvalidCredentials

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
    login = LoginUserUseCase(user_repo, refresh_repo, hasher, tokens)
    return register, login


async def test_login_success():
    register, login = build()
    await register.execute(RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User"))

    result = await login.execute(
        LoginUserCommand(email="m@t.com", password="senha-forte-1")
    )

    assert result.user_email == "m@t.com"
    assert result.access_token.startswith("access-")


async def test_login_with_wrong_password_raises_generic():
    register, login = build()
    await register.execute(RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User"))

    with pytest.raises(InvalidCredentials):
        await login.execute(LoginUserCommand(email="m@t.com", password="errada-1"))


async def test_login_with_unknown_email_raises_generic():
    _, login = build()

    with pytest.raises(InvalidCredentials):
        await login.execute(LoginUserCommand(email="nao-existe@t.com", password="x-1"))


async def test_login_with_case_insensitive_email():
    register, login = build()
    await register.execute(RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User"))

    result = await login.execute(
        LoginUserCommand(email="M@T.COM", password="senha-forte-1")
    )

    assert result.user_email == "m@t.com"
