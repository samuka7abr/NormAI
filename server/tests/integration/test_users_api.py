import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from infrastructure.persistence.database import AsyncSessionLocal
from main import app

BASE = "http://test"


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    yield
    async with AsyncSessionLocal() as session:
        await session.execute(
            text("TRUNCATE TABLE projects, refresh_tokens, users CASCADE")
        )
        await session.commit()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        yield c


@pytest_asyncio.fixture
async def authed_client(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )
    return client


async def test_get_me_authenticated_returns_user(authed_client: AsyncClient):
    resp = await authed_client.get("/users/me")

    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "m@t.com"
    assert "id" in body


async def test_get_me_without_auth_returns_401(client: AsyncClient):
    resp = await client.get("/users/me")
    assert resp.status_code == 401


async def test_change_password_success(authed_client: AsyncClient):
    resp = await authed_client.patch(
        "/users/me/password",
        json={
            "current_password": "senha-forte-1",
            "new_password": "nova-forte-2",
        },
    )

    assert resp.status_code == 200
    assert resp.json() == {"password_updated": True}


async def test_change_password_wrong_current_returns_401(authed_client: AsyncClient):
    resp = await authed_client.patch(
        "/users/me/password",
        json={
            "current_password": "errada-1",
            "new_password": "nova-forte-2",
        },
    )

    assert resp.status_code == 401


async def test_change_password_without_auth_returns_401(client: AsyncClient):
    resp = await client.patch(
        "/users/me/password",
        json={
            "current_password": "senha-forte-1",
            "new_password": "nova-forte-2",
        },
    )

    assert resp.status_code == 401


async def test_change_password_revokes_session(authed_client: AsyncClient):
    await authed_client.patch(
        "/users/me/password",
        json={
            "current_password": "senha-forte-1",
            "new_password": "nova-forte-2",
        },
    )

    me = await authed_client.get("/users/me")
    assert me.status_code == 401


async def test_login_with_new_password_after_change(authed_client: AsyncClient):
    await authed_client.patch(
        "/users/me/password",
        json={
            "current_password": "senha-forte-1",
            "new_password": "nova-forte-2",
        },
    )

    resp = await authed_client.post(
        "/auth/login",
        json={"email": "m@t.com", "password": "nova-forte-2"},
    )
    assert resp.status_code == 200

    resp2 = await authed_client.post(
        "/auth/login",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )
    assert resp2.status_code == 401
