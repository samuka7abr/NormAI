import pytest

from application.auth.dtos import RegisterUserCommand
from application.auth.register_user import RegisterUserUseCase
from domain.users.exceptions import EmailAlreadyExists, WeakPassword

from tests.unit.application._helpers import (
    FakePasswordHasher,
    FakeRefreshTokenRepository,
    FakeTokenService,
    FakeUserRepository,
)


def make_use_case():
    return RegisterUserUseCase(
        user_repo=FakeUserRepository(),
        refresh_token_repo=FakeRefreshTokenRepository(),
        password_hasher=FakePasswordHasher(),
        token_service=FakeTokenService(),
    )


async def test_register_user_success():
    uc = make_use_case()

    result = await uc.execute(
        RegisterUserCommand(email="maria@test.com", password="senha-forte-1", name="Maria", last_name="Silva")
    )

    assert result.user_email == "maria@test.com"
    assert result.access_token.startswith("access-")
    assert result.refresh_token.startswith("refresh-")


async def test_register_user_normalizes_email():
    uc = make_use_case()

    result = await uc.execute(
        RegisterUserCommand(email="MARIA@Test.COM ", password="senha-forte-1", name="Maria", last_name="Silva")
    )

    assert result.user_email == "maria@test.com"


async def test_register_user_with_duplicate_email_raises():
    uc = make_use_case()
    await uc.execute(RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User"))

    with pytest.raises(EmailAlreadyExists):
        await uc.execute(RegisterUserCommand(email="m@t.com", password="outra-senha-1", name="Test", last_name="User"))


async def test_register_user_with_weak_password_raises():
    uc = make_use_case()

    with pytest.raises(WeakPassword):
        await uc.execute(RegisterUserCommand(email="m@t.com", password="abc", name="Test", last_name="User"))


async def test_register_user_password_is_never_plain():
    """Senha pura nunca deve ser armazenada como password_hash."""
    user_repo = FakeUserRepository()
    uc = RegisterUserUseCase(
        user_repo=user_repo,
        refresh_token_repo=FakeRefreshTokenRepository(),
        password_hasher=FakePasswordHasher(),
        token_service=FakeTokenService(),
    )

    await uc.execute(RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User"))

    user = await user_repo.find_by_email("m@t.com")
    assert user is not None
    #hash não pode ser igual à senha em texto puro.
    assert user.password_hash != "senha-forte-1"
    assert user.password_hash.startswith("HASH:")  # confirma que passou pelo hasher