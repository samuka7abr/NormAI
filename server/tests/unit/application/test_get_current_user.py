from uuid import uuid4

import pytest

from application.users.get_current_user import GetCurrentUserUseCase
from domain.users.entities import User
from domain.users.exceptions import UserNotFound

from tests.unit.application._helpers import FakeUserRepository


async def test_get_current_user_success():
    repo = FakeUserRepository()
    user = User(email="m@t.com", password_hash="HASH:x", name="Test", last_name="User")
    await repo.save(user)
    uc = GetCurrentUserUseCase(user_repo=repo)

    view = await uc.execute(user.id)

    assert view.id == user.id
    assert view.email == "m@t.com"


async def test_get_current_user_not_found_raises():
    uc = GetCurrentUserUseCase(user_repo=FakeUserRepository())

    with pytest.raises(UserNotFound):
        await uc.execute(uuid4())
