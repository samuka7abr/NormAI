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
            text("TRUNCATE TABLE activities, projects, refresh_tokens, users CASCADE")
        )
        await session.commit()


async def register_and_login(client: AsyncClient, email: str, password: str = "Senha@123") -> None:
    await client.post(
        "/auth/register",
        json={"name": "Test", "last_name": "User", "email": email, "password": password},
    )
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


async def test_list_activities_unauthenticated():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        resp = await c.get("/activities")
    assert resp.status_code == 401


async def test_list_activities_empty(client_a: AsyncClient):
    resp = await client_a.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_activities_after_create_project(client_a: AsyncClient):
    await client_a.post("/projects", json={"name": "Meu Projeto", "description": "", "ai_context": ""})

    resp = await client_a.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    activity = data["items"][0]
    assert activity["type"] == "project_created"
    assert activity["project_name"] == "Meu Projeto"
    assert "id" in activity
    assert "project_id" in activity
    assert "created_at" in activity


async def test_list_activities_response_shape(client_a: AsyncClient):
    await client_a.post("/projects", json={"name": "Shape Test", "description": "", "ai_context": ""})

    resp = await client_a.get("/activities")
    activity = resp.json()["items"][0]

    assert set(activity.keys()) == {"id", "type", "project_id", "project_name", "created_at"}


async def test_list_activities_pagination(client_a: AsyncClient):
    for i in range(5):
        await client_a.post(
            "/projects", json={"name": f"Projeto {i}", "description": "", "ai_context": ""}
        )

    resp = await client_a.get("/activities?limit=3&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 3
    assert data["total"] == 5

    resp2 = await client_a.get("/activities?limit=3&offset=3")
    data2 = resp2.json()
    assert len(data2["items"]) == 2
    assert data2["total"] == 5


async def test_list_activities_user_isolation(client_a: AsyncClient, client_b: AsyncClient):
    await client_a.post("/projects", json={"name": "Projeto A", "description": "", "ai_context": ""})

    resp = await client_b.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_activities_limit_max_50(client_a: AsyncClient):
    resp = await client_a.get("/activities?limit=100")
    assert resp.status_code == 422


async def test_list_activities_ordered_most_recent_first(client_a: AsyncClient):
    for i in range(3):
        await client_a.post(
            "/projects", json={"name": f"Projeto {i}", "description": "", "ai_context": ""}
        )

    resp = await client_a.get("/activities")
    items = resp.json()["items"]
    created_ats = [item["created_at"] for item in items]
    assert created_ats == sorted(created_ats, reverse=True)
