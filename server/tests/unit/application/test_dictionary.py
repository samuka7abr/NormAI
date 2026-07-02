from uuid import UUID, uuid4

import pytest

from application.dictionary.create_entry import CreateDictionaryEntryUseCase
from application.dictionary.delete_entry import DeleteDictionaryEntryUseCase
from application.dictionary.dtos import CreateDictionaryEntryInput, ListDictionaryEntriesInput, UpdateDictionaryEntryInput
from application.dictionary.get_entry import GetDictionaryEntryUseCase
from application.dictionary.list_entries import ListDictionaryEntriesUseCase
from application.dictionary.update_entry import UpdateDictionaryEntryUseCase
from domain.dictionary.entities import DictionaryEntry, DictionaryEntryKind, DictionaryStats
from domain.dictionary.exceptions import DictionaryEntryNameAlreadyExists, DictionaryEntryNotFound
from domain.dictionary.repositories import DictionaryEntryRepository


class InMemoryDictionaryEntryRepository(DictionaryEntryRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, DictionaryEntry] = {}

    async def create(self, entry: DictionaryEntry) -> DictionaryEntry:
        for e in self._store.values():
            if entry.project_id is None:
                if e.project_id is None and e.user_id == entry.user_id and e.kind == entry.kind and e.name == entry.name:
                    raise DictionaryEntryNameAlreadyExists(f"Entry '{entry.name}' already exists")
            else:
                if e.project_id == entry.project_id and e.kind == entry.kind and e.name == entry.name:
                    raise DictionaryEntryNameAlreadyExists(f"Entry '{entry.name}' already exists")
        self._store[entry.id] = entry
        return entry

    async def get_by_id(self, id: UUID, user_id: UUID) -> DictionaryEntry | None:
        e = self._store.get(id)
        return e if e and e.user_id == user_id else None

    async def list_global(self, user_id, kind, offset, limit, q=None):
        all_ = [e for e in self._store.values() if e.user_id == user_id and e.project_id is None]
        if kind:
            all_ = [e for e in all_ if e.kind == kind]
        if q:
            q_lower = q.lower()
            all_ = [e for e in all_ if q_lower in e.name.lower() or q_lower in e.description.lower()]
        return all_[offset:offset + limit], len(all_)

    async def list_by_project(self, project_id, user_id, kind, offset, limit, q=None):
        all_ = [e for e in self._store.values() if e.project_id == project_id and e.user_id == user_id]
        if kind:
            all_ = [e for e in all_ if e.kind == kind]
        if q:
            q_lower = q.lower()
            all_ = [e for e in all_ if q_lower in e.name.lower() or q_lower in e.description.lower()]
        return all_[offset:offset + limit], len(all_)

    async def list_merged(self, user_id, project_id, kind):
        entries = [
            e for e in self._store.values()
            if e.user_id == user_id and (e.project_id == project_id or e.project_id is None)
        ]
        if kind:
            entries = [e for e in entries if e.kind == kind]
        project_keys = {(e.kind, e.name) for e in entries if e.project_id is not None}
        return [e for e in entries if e.project_id is not None or (e.kind, e.name) not in project_keys]

    async def update(self, entry: DictionaryEntry) -> DictionaryEntry:
        for e in self._store.values():
            if e.id != entry.id and e.user_id == entry.user_id and e.project_id == entry.project_id and e.kind == entry.kind and e.name == entry.name:
                raise DictionaryEntryNameAlreadyExists(f"Entry '{entry.name}' already exists")
        self._store[entry.id] = entry
        return entry

    async def delete(self, id: UUID, user_id: UUID) -> None:
        del self._store[id]

    async def get_stats(self, user_id: UUID) -> DictionaryStats:
        entries = [e for e in self._store.values() if e.user_id == user_id and e.project_id is None]
        by_type: dict[str, int] = {}
        for e in entries:
            by_type[e.kind.value] = by_type.get(e.kind.value, 0) + 1
        return DictionaryStats(
            total=len(entries),
            by_type=by_type,
            total_applications=0,
            unused_count=len(entries),
            most_used=[],
        )


def make_input(user_id: UUID, project_id: UUID | None = None, name: str = "Preset A") -> CreateDictionaryEntryInput:
    return CreateDictionaryEntryInput(
        user_id=user_id,
        project_id=project_id,
        kind=DictionaryEntryKind.mappings,
        name=name,
        description="",
        payload={"pairs": [["MP", "Ministério Público"]]},
    )


async def test_create_global_ok():
    repo = InMemoryDictionaryEntryRepository()
    uc = CreateDictionaryEntryUseCase(repo)
    result = await uc.execute(make_input(uuid4()))
    assert result.name == "Preset A"
    assert result.project_id is None


async def test_create_project_ok():
    repo = InMemoryDictionaryEntryRepository()
    uc = CreateDictionaryEntryUseCase(repo)
    project_id = uuid4()
    result = await uc.execute(make_input(uuid4(), project_id=project_id))
    assert result.project_id == project_id


async def test_create_duplicate_global_raises():
    repo = InMemoryDictionaryEntryRepository()
    uc = CreateDictionaryEntryUseCase(repo)
    user_id = uuid4()
    await uc.execute(make_input(user_id))
    with pytest.raises(DictionaryEntryNameAlreadyExists):
        await uc.execute(make_input(user_id))


async def test_create_same_name_global_and_project_ok():
    repo = InMemoryDictionaryEntryRepository()
    uc = CreateDictionaryEntryUseCase(repo)
    user_id = uuid4()
    project_id = uuid4()
    await uc.execute(make_input(user_id))
    await uc.execute(make_input(user_id, project_id=project_id))  # mesmo nome, escopo diferente — deve passar


async def test_get_ok():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    get_uc = GetDictionaryEntryUseCase(repo)
    user_id = uuid4()
    created = await create_uc.execute(make_input(user_id))
    result = await get_uc.execute(id=created.id, user_id=user_id)
    assert result.id == created.id


async def test_get_not_found_raises():
    repo = InMemoryDictionaryEntryRepository()
    uc = GetDictionaryEntryUseCase(repo)
    with pytest.raises(DictionaryEntryNotFound):
        await uc.execute(id=uuid4(), user_id=uuid4())


async def test_list_global_paginated():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    list_uc = ListDictionaryEntriesUseCase(repo)
    user_id = uuid4()
    for i in range(5):
        await create_uc.execute(make_input(user_id, name=f"Preset {i}"))
    result = await list_uc.execute(ListDictionaryEntriesInput(user_id=user_id, project_id=None, kind=None, page=1, page_size=3))
    assert len(result.items) == 3
    assert result.total == 5
    assert result.total_pages == 2


async def test_list_global_search():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    list_uc = ListDictionaryEntriesUseCase(repo)
    user_id = uuid4()
    await create_uc.execute(CreateDictionaryEntryInput(
        user_id=user_id, project_id=None, kind=DictionaryEntryKind.mappings,
        name="Tribunal SP", description="sigla canônica", payload={}
    ))
    await create_uc.execute(CreateDictionaryEntryInput(
        user_id=user_id, project_id=None, kind=DictionaryEntryKind.mappings,
        name="Comarca Azul", description="outra coisa", payload={}
    ))
    result = await list_uc.execute(ListDictionaryEntriesInput(
        user_id=user_id, project_id=None, kind=None, page=1, page_size=10, q="tribunal"
    ))
    assert result.total == 1
    assert result.items[0].name == "Tribunal SP"


async def test_list_project_isolated_from_global():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    list_uc = ListDictionaryEntriesUseCase(repo)
    user_id = uuid4()
    project_id = uuid4()
    await create_uc.execute(make_input(user_id, name="Global"))
    await create_uc.execute(make_input(user_id, project_id=project_id, name="Projeto"))
    result = await list_uc.execute(ListDictionaryEntriesInput(user_id=user_id, project_id=project_id, kind=None, page=1, page_size=10))
    assert result.total == 1
    assert result.items[0].name == "Projeto"


async def test_list_merged_project_overrides_global():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    user_id = uuid4()
    project_id = uuid4()
    await create_uc.execute(make_input(user_id, name="Preset A"))           # global
    await create_uc.execute(make_input(user_id, project_id=project_id, name="Preset A"))  # projeto override
    await create_uc.execute(make_input(user_id, name="Preset B"))           # global sem override

    merged = await repo.list_merged(user_id=user_id, project_id=project_id, kind=None)

    # Preset A deve aparecer apenas a versão do projeto
    preset_a = [e for e in merged if e.name == "Preset A"]
    assert len(preset_a) == 1
    assert preset_a[0].project_id == project_id

    # Preset B (só global, sem override) deve aparecer
    preset_b = [e for e in merged if e.name == "Preset B"]
    assert len(preset_b) == 1
    assert preset_b[0].project_id is None


async def test_update_ok():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    update_uc = UpdateDictionaryEntryUseCase(repo)
    user_id = uuid4()
    created = await create_uc.execute(make_input(user_id))
    result = await update_uc.execute(UpdateDictionaryEntryInput(id=created.id, user_id=user_id, name="Novo Nome", description=None, payload=None))
    assert result.name == "Novo Nome"
    assert result.payload == created.payload  # não alterado


async def test_update_description_ok():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    update_uc = UpdateDictionaryEntryUseCase(repo)
    user_id = uuid4()
    created = await create_uc.execute(make_input(user_id))
    result = await update_uc.execute(UpdateDictionaryEntryInput(id=created.id, user_id=user_id, name=None, description="nova descrição", payload=None))
    assert result.description == "nova descrição"
    assert result.name == created.name  # não alterado


async def test_update_not_found_raises():
    repo = InMemoryDictionaryEntryRepository()
    uc = UpdateDictionaryEntryUseCase(repo)
    with pytest.raises(DictionaryEntryNotFound):
        await uc.execute(UpdateDictionaryEntryInput(id=uuid4(), user_id=uuid4(), name="X", description=None, payload=None))


async def test_delete_ok():
    repo = InMemoryDictionaryEntryRepository()
    create_uc = CreateDictionaryEntryUseCase(repo)
    delete_uc = DeleteDictionaryEntryUseCase(repo)
    get_uc = GetDictionaryEntryUseCase(repo)
    user_id = uuid4()
    created = await create_uc.execute(make_input(user_id))
    await delete_uc.execute(id=created.id, user_id=user_id)
    with pytest.raises(DictionaryEntryNotFound):
        await get_uc.execute(id=created.id, user_id=user_id)


async def test_delete_not_found_raises():
    repo = InMemoryDictionaryEntryRepository()
    uc = DeleteDictionaryEntryUseCase(repo)
    with pytest.raises(DictionaryEntryNotFound):
        await uc.execute(id=uuid4(), user_id=uuid4())
