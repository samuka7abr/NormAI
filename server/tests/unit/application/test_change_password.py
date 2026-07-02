from uuid import uuid4

import pytest

from application.auth.dtos import RegisterUserCommand
from application.auth.register_user import RegisterUserUseCase
from application.users.change_password import ChangePasswordUseCase
from application.users.dtos import ChangePasswordCommand
from domain.auth.exceptions import InvalidCredentials
from domain.users.exceptions import SamePassword, UserNotFound, WeakPassword

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
    change = ChangePasswordUseCase(user_repo, refresh_repo, hasher)
    return register, change, user_repo, refresh_repo


async def test_change_password_success():
    register, change, user_repo, _ = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    await change.execute(
        ChangePasswordCommand(
            user_id=session.user_id,
            current_password="senha-forte-1",
            new_password="nova-forte-2",
        )
    )

    user = await user_repo.find_by_id(session.user_id)
    assert user.password_hash == "HASH:nova-forte-2"


async def test_change_password_with_wrong_current_raises():
    register, change, _, _ = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    with pytest.raises(InvalidCredentials):
        await change.execute(
            ChangePasswordCommand(
                user_id=session.user_id,
                current_password="errada-1",
                new_password="nova-forte-2",
            )
        )


async def test_change_password_with_same_password_raises():
    register, change, _, _ = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    with pytest.raises(SamePassword):
        await change.execute(
            ChangePasswordCommand(
                user_id=session.user_id,
                current_password="senha-forte-1",
                new_password="senha-forte-1",
            )
        )


async def test_change_password_with_weak_new_raises():
    register, change, _, _ = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    with pytest.raises(WeakPassword):
        await change.execute(
            ChangePasswordCommand(
                user_id=session.user_id,
                current_password="senha-forte-1",
                new_password="abc",
            )
        )


async def test_change_password_revokes_all_refresh_tokens():
    register, change, _, refresh_repo = build()
    session = await register.execute(
        RegisterUserCommand(email="m@t.com", password="senha-forte-1", name="Test", last_name="User")
    )

    assert len(refresh_repo.all_active_for(session.user_id)) == 1

    await change.execute(
        ChangePasswordCommand(
            user_id=session.user_id,
            current_password="senha-forte-1",
            new_password="nova-forte-2",
        )
    )

    assert len(refresh_repo.all_active_for(session.user_id)) == 0


async def test_change_password_for_nonexistent_user_raises():
    _, change, _, _ = build()

    with pytest.raises(UserNotFound):
        await change.execute(
            ChangePasswordCommand(
                user_id=uuid4(),
                current_password="x-1",
                new_password="nova-forte-2",
            )
        )
