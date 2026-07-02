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


async def test_register_returns_201_and_sets_cookies(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={"email": "maria@test.com", "password": "senha-forte-1", "name": "Maria", "last_name": "Silva"},
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "maria@test.com"
    assert "id" in body

    cookies = resp.cookies
    assert "access_token" in cookies
    assert "refresh_token" in cookies


async def test_register_duplicate_email_returns_409(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "dup@test.com", "password": "senha-forte-1", "name": "Dup", "last_name": "User"},
    )
    resp = await client.post(
        "/auth/register",
        json={"email": "dup@test.com", "password": "outra-forte-2", "name": "Dup", "last_name": "User"},
    )

    assert resp.status_code == 409


async def test_register_weak_password_returns_422(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={"email": "x@t.com", "password": "abc", "name": "X", "last_name": "T"},
    )

    assert resp.status_code == 422


async def test_login_success_returns_200(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )

    resp = await client.post(
        "/auth/login",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )

    assert resp.status_code == 200
    assert "access_token" in resp.cookies


async def test_login_wrong_password_returns_401_generic(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )

    resp = await client.post(
        "/auth/login",
        json={"email": "m@t.com", "password": "errada-1"},
    )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials."


async def test_login_unknown_email_returns_401_generic(client: AsyncClient):
    resp = await client.post(
        "/auth/login",
        json={"email": "nao-existe@t.com", "password": "senha-forte-1"},
    )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials."


async def test_refresh_rotates_tokens(client: AsyncClient):
    """Refresh deve retornar 200 e emitir novos cookies de sessão."""
    await client.post(
        "/auth/register",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )

    resp = await client.post("/auth/refresh")

    assert resp.status_code == 200
    # Refresh emite novos cookies 
    set_cookie_headers = resp.headers.get_list("set-cookie")
    assert any("access_token=" in h for h in set_cookie_headers)
    assert any("refresh_token=" in h for h in set_cookie_headers)


async def test_refresh_without_cookie_returns_401(client: AsyncClient):
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401


async def test_logout_revokes_session(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )

    resp = await client.post("/auth/logout")
    assert resp.status_code == 200

    me = await client.get("/users/me")
    assert me.status_code == 401


async def test_reset_forgotten_password_success(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )

    resp = await client.post(
        "/auth/reset-password",
        json={"email": "m@t.com", "new_password": "nova-forte-2"},
    )

    assert resp.status_code == 204

    login = await client.post(
        "/auth/login",
        json={"email": "m@t.com", "password": "nova-forte-2"},
    )
    assert login.status_code == 200


async def test_reset_forgotten_password_unknown_email_returns_404(client: AsyncClient):
    resp = await client.post(
        "/auth/reset-password",
        json={"email": "naoexiste@t.com", "new_password": "nova-forte-2"},
    )

    assert resp.status_code == 404


async def test_reset_forgotten_password_weak_password_returns_422(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "m@t.com", "password": "senha-forte-1", "name": "Test", "last_name": "User"},
    )

    resp = await client.post(
        "/auth/reset-password",
        json={"email": "m@t.com", "new_password": "abc"},
    )

    assert resp.status_code == 422