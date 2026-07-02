import pytest

from application.auth.dtos import RegisterUserCommand
from application.auth.register_user import RegisterUserUseCase
from application.users.dtos import ResetForgottenPasswordCommand
from application.users.reset_forgotten_password import ResetForgottenPasswordUseCase
from domain.users.exceptions import UserNotFound, WeakPassword

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
    reset = ResetForgottenPasswordUseCase(user_repo, refresh_repo, hasher)
    return register, reset, user_repo, refresh_repo


async def test_reset_forgotten_password_success():
    register, reset, user_repo, _ = build()
    await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    await reset.execute(
        ResetForgottenPasswordCommand(email="m@t.com", new_password="nova-forte-2")
    )

    user = await user_repo.find_by_email("m@t.com")
    assert user.password_hash == "HASH:nova-forte-2"


async def test_reset_forgotten_password_revokes_all_refresh_tokens():
    register, reset, _, refresh_repo = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    assert len(refresh_repo.all_active_for(session.user_id)) == 1

    await reset.execute(
        ResetForgottenPasswordCommand(email="m@t.com", new_password="nova-forte-2")
    )

    assert len(refresh_repo.all_active_for(session.user_id)) == 0


async def test_reset_forgotten_password_weak_password_raises():
    register, reset, _, _ = build()
    await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    with pytest.raises(WeakPassword):
        await reset.execute(
            ResetForgottenPasswordCommand(email="m@t.com", new_password="abc")
        )


async def test_reset_forgotten_password_unknown_email_raises():
    _, reset, _, _ = build()

    with pytest.raises(UserNotFound):
        await reset.execute(
            ResetForgottenPasswordCommand(email="naoexiste@t.com", new_password="nova-forte-2")
        )
