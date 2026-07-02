import pytest
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
        await session.execute(text("TRUNCATE TABLE projects, refresh_tokens, users CASCADE"))
        await session.commit()


async def register_and_login(client: AsyncClient, email: str, password: str = "Senha@123") -> None:
    await client.post("/auth/register", json={"name": "Test", "last_name": "User", "email": email, "password": password})
    await client.post("/auth/login", json={"email": email, "password": password})


@pytest_asyncio.fixture
async def client_a():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        await register_and_login(c, "user_a@test.com")
        yield c


@pytest_asyncio.fixture
async def client_b():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        await register_and_login(c, "user_b@test.com")
        yield c


async def test_create_project(client_a: AsyncClient):
    resp = await client_a.post("/projects", json={"name": "Proj A", "description": "d", "ai_context": ""})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Proj A"


async def test_create_duplicate_returns_409(client_a: AsyncClient):
    await client_a.post("/projects", json={"name": "Proj A", "description": "", "ai_context": ""})
    resp = await client_a.post("/projects", json={"name": "Proj A", "description": "", "ai_context": ""})
    assert resp.status_code == 409


async def test_list_projects(client_a: AsyncClient):
    await client_a.post("/projects", json={"name": "P1", "description": "", "ai_context": ""})
    await client_a.post("/projects", json={"name": "P2", "description": "", "ai_context": ""})

    resp = await client_a.get("/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_get_project(client_a: AsyncClient):
    created = (await client_a.post("/projects", json={"name": "P1", "description": "", "ai_context": ""})).json()

    resp = await client_a.get(f"/projects/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


async def test_get_project_not_found(client_a: AsyncClient):
    resp = await client_a.get("/projects/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


async def test_update_project(client_a: AsyncClient):
    created = (await client_a.post("/projects", json={"name": "Antigo", "description": "", "ai_context": ""})).json()

    resp = await client_a.patch(f"/projects/{created['id']}", json={"name": "Novo"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Novo"
    assert resp.json()["description"] == ""  # não alterado


async def test_delete_project(client_a: AsyncClient):
    created = (await client_a.post("/projects", json={"name": "P1", "description": "", "ai_context": ""})).json()

    resp = await client_a.delete(f"/projects/{created['id']}")
    assert resp.status_code == 204

    resp = await client_a.get(f"/projects/{created['id']}")
    assert resp.status_code == 404


async def test_isolation_user_b_cannot_see_user_a_project(client_a: AsyncClient, client_b: AsyncClient):
    created = (await client_a.post("/projects", json={"name": "Secreto", "description": "", "ai_context": ""})).json()

    resp = await client_b.get(f"/projects/{created['id']}")
    assert resp.status_code == 404


async def test_pagination(client_a: AsyncClient):
    for i in range(5):
        await client_a.post("/projects", json={"name": f"P{i}", "description": "", "ai_context": ""})

    resp = await client_a.get("/projects?page=1&page_size=3")
    data = resp.json()
    assert len(data["items"]) == 3
    assert data["total"] == 5
    assert data["total_pages"] == 2
