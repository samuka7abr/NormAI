# Changelog — DictionaryEntry

## Iteração 2 — Integração com frontend (2026-05-25)

Adaptação do CRUD existente para o contrato esperado pela página `/dictionary` do frontend, cobrindo Prioridades 1 e 2 do `dictionaryIntegration.md`.

### Domínio (`src/domain/dictionary/`)
- `DictionaryEntryKind` — valores renomeados para slugs do frontend:
  - `NORMALIZATION_PRESET` → `mappings`
  - `CATEGORY_LIST` → `categories`
  - `CLASSIFICATION_INSTRUCTION` → `context`
- `DictionaryEntry` — adicionados campos `description: str` e `used_in: list[UUID]` (default `[]`, populado pelo repositório na listagem).
- `DictionaryStats`, `DictionaryMostUsed` — novos dataclasses para o endpoint de estatísticas.
- `DictionaryEntryRepository` — interface atualizada:
  - `list_global` e `list_by_project` recebem `q: str | None` (busca textual).
  - Novo método abstrato `get_stats(user_id) -> DictionaryStats`.

### Aplicação (`src/application/dictionary/`)
- `CreateDictionaryEntryUseCase` — passa `description` ao criar a entidade.
- `UpdateDictionaryEntryUseCase` — suporte a partial update de `description`.
- `ListDictionaryEntriesUseCase` — repassa `q` ao repositório.
- `GetDictionaryStatsUseCase` (**novo**) — delega para `repo.get_stats(user_id)`.
- DTOs atualizados: `description` em `CreateDictionaryEntryInput`, `UpdateDictionaryEntryInput` e `DictionaryEntryOutput`; `q` em `ListDictionaryEntriesInput`; `used_in` em `DictionaryEntryOutput`.

### Infraestrutura (`src/infrastructure/persistence/`)
- `DictionaryEntryModel` — coluna `description (Text NOT NULL DEFAULT '')` adicionada.
- `DictionaryApplicationModel` (**novo**) — tabela `dictionary_applications`:
  - `id`, `entry_id` (FK → dictionary_entries CASCADE), `project_id` (FK → projects CASCADE), `column_name (VARCHAR 80)`, `applied_at`.
  - `UNIQUE (entry_id, project_id, column_name)`.
- `SqlAlchemyDictionaryEntryRepository` — métodos atualizados:
  - `list_global` / `list_by_project`: subquery correlacionada agrega `used_in` (array de `project_id` distintos de `dictionary_applications`); filtro ILIKE em `name`, `description` e `payload` (cast para texto) quando `q` é fornecido.
  - `get_stats` (**novo**): total por kind, total de aplicações, entradas sem uso, top 4 mais reutilizadas — tudo em queries separadas e assíncronas.
- Migration `a1b2c3d4e5f6_update_dictionary_for_frontend_integration.py` — aplicada:
  - `UPDATE` dos valores de kind nas linhas existentes.
  - `ADD COLUMN description`.
  - `CREATE TABLE dictionary_applications` com índices em `entry_id` e `project_id`.

### Apresentação (`src/presentation/http/`)
- **Request** (`CreateDictionaryEntryRequest` / `UpdateDictionaryEntryRequest`):
  - `payload` removido — substituído por campos planos: `items`, `content`, `pairs` (todos opcionais).
  - `description (max 500)` adicionado.
  - A rota monta o `payload` internamente via `_build_payload()`.
- **Response** (`DictionaryEntryResponse`) — reformulada para o contrato do frontend:
  - `kind` exposto como `type`; `name` exposto como `title`.
  - `description`, `used_in` e `updated_at` incluídos.
  - `items` / `content` / `pairs` extraídos do `payload` conforme o `kind`.
  - Campos internos (`user_id`, `project_id`, `created_at`, `payload`) removidos da resposta pública.
- **Novos endpoints**:
  - `GET /dictionary/stats` — registrado **antes** de `/{entry_id}` para evitar colisão com FastAPI.
  - `GET /dictionary?q=` e `GET /projects/{id}/dictionary?q=` — busca textual.
- `DictionaryStatsResponse`, `DictionaryMostUsedResponse` — novos schemas Pydantic.
- Dependência `get_stats_use_case` adicionada em `dependencies/dictionary.py`.

### Testes
- **123/123 passando**.
- Testes unitários: `InMemoryDictionaryEntryRepository` atualizado com `get_stats` e filtro `q`; adicionados `test_list_global_search` e `test_update_description_ok`.
- Testes de integração: `ENTRY` migrado para o novo formato (`pairs` plano, `description`); adicionados `test_list_global_search`, `test_get_stats`, `test_categories_entry_response`, `test_context_entry_response`.
- `TRUNCATE` do `clean_db` inclui `dictionary_applications`.

---

## Iteração 1 — CRUD base (anterior)

Implementação completa do CRUD de dicionário em 5 camadas (Clean Architecture), com suporte a dois escopos: **dicionário global do usuário** e **dicionário por projeto**, onde o projeto tem precedência em conflitos.

### Domínio
- `DictionaryEntryKind` — enum com 3 tipos.
- `DictionaryEntry` — dataclass com `id`, `user_id`, `project_id` (nullable), `kind`, `name`, `payload (dict)`, timestamps.
- `DictionaryEntryNotFound`, `DictionaryEntryNameAlreadyExists` — exceções de domínio.
- `DictionaryEntryRepository` (ABC) — interface com `create`, `get_by_id`, `list_global`, `list_by_project`, `list_merged`, `update`, `delete`.

### Aplicação
- `CreateDictionaryEntryUseCase`, `GetDictionaryEntryUseCase`, `ListDictionaryEntriesUseCase`, `UpdateDictionaryEntryUseCase`, `DeleteDictionaryEntryUseCase`.

### Infraestrutura
- `DictionaryEntryModel` com dois índices únicos parciais:
  - `uq_dictionary_global` — `UNIQUE (user_id, kind, name) WHERE project_id IS NULL`
  - `uq_dictionary_project` — `UNIQUE (project_id, kind, name) WHERE project_id IS NOT NULL`
- `SqlAlchemyDictionaryEntryRepository` com `list_merged` aplicando precedência em memória.
- Migration `4ec107f5c802_add_dictionary_entries_table.py`.

### Apresentação
- Dois routers: `/dictionary` e `/projects/{project_id}/dictionary`.
- 10 endpoints (5 por escopo), exceções mapeadas: `NotFound → 404`, `AlreadyExists → 409`, `ValueError → 422`.

---

## Como funciona

```
Request HTTP
    └─> FastAPI route (routes/dictionary.py)
            └─> Depends(get_current_user_id)        # valida JWT do cookie
            └─> Use Case (application/dictionary/)
                    └─> DictionaryEntryRepository (domain interface)
                            └─> SqlAlchemyDictionaryEntryRepository (infrastructure)
                                    └─> AsyncSession → Postgres
```

### Dois escopos

| `project_id` | Escopo | Constraint de unicidade |
|---|---|---|
| `NULL` | Global (usuário) | `UNIQUE (user_id, kind, name) WHERE project_id IS NULL` |
| `<uuid>` | Projeto | `UNIQUE (project_id, kind, name) WHERE project_id IS NOT NULL` |

### Regra de precedência (merge)

Usado pelo pipeline de processamento via `list_merged(user_id, project_id, kind)`:

```
Global:  "MP" → "ministerio_publico"    (mappings, name="Preset A")
Projeto: "MP" → "ministerio-publico"    (mappings, name="Preset A")

Resultado do merge → entrada do PROJETO vence (mesmo kind + name)
Entradas globais sem override continuam válidas
```

---

## Endpoints disponíveis

### Dicionário Global (`/dictionary`)

| Método | Rota | Status | Descrição |
|---|---|---|---|
| POST | `/dictionary` | 201 | Cria entrada no dicionário global |
| GET | `/dictionary?kind=&q=&page=&page_size=` | 200 | Lista entradas globais; `q` busca em name, description e payload |
| GET | `/dictionary/stats` | 200 | Estatísticas da sidebar (total, by_type, aplicações, unused, top 4) |
| GET | `/dictionary/{id}` | 200 / 404 | Busca entrada por id |
| PATCH | `/dictionary/{id}` | 200 / 404 / 409 | Atualiza name, description e/ou payload |
| DELETE | `/dictionary/{id}` | 204 / 404 | Remove entrada |

### Dicionário de Projeto (`/projects/{project_id}/dictionary`)

| Método | Rota | Status | Descrição |
|---|---|---|---|
| POST | `/projects/{project_id}/dictionary` | 201 | Cria entrada no dicionário do projeto |
| GET | `/projects/{project_id}/dictionary?kind=&q=&page=&page_size=` | 200 | Lista entradas do projeto |
| GET | `/projects/{project_id}/dictionary/{id}` | 200 / 404 | Busca entrada por id |
| PATCH | `/projects/{project_id}/dictionary/{id}` | 200 / 404 / 409 | Atualiza name, description e/ou payload |
| DELETE | `/projects/{project_id}/dictionary/{id}` | 204 / 404 | Remove entrada |

### Contrato de request (POST e PATCH)

```json
{
  "kind":        "categories | context | mappings",
  "name":        "string (max 120)",
  "description": "string (max 500)",
  "items":       ["string"],          // só para kind=categories
  "content":     "string",            // só para kind=context
  "pairs":       [["de", "para"]]     // só para kind=mappings
}
```

### Contrato de response (item da lista e GET por id)

```json
{
  "id":          "uuid",
  "type":        "categories | context | mappings",
  "title":       "string",
  "description": "string",
  "used_in":     ["project-uuid-1"],
  "updated_at":  "ISO timestamp",
  "items":       ["string"] | null,
  "content":     "string"   | null,
  "pairs":       [["de","para"]] | null
}
```

### Contrato de response do `/dictionary/stats`

```json
{
  "total": 10,
  "by_type": { "categories": 4, "context": 3, "mappings": 3 },
  "total_applications": 17,
  "unused_count": 2,
  "most_used": [
    { "id": "...", "title": "...", "type": "...", "used_count": 5 }
  ]
}
```

### Regras de negócio

- `kind` é imutável após a criação.
- O mesmo `name` pode existir em escopo global e de projeto simultaneamente.
- `GET /dictionary/stats` deve ser registrado **antes** de `GET /dictionary/{id}` no router para o FastAPI não confundir `"stats"` com um UUID.
- Deleção do projeto cascateia entradas de dicionário e aplicações via FK `ON DELETE CASCADE`.

---

## O que falta (ordem do plano)

| # | Entidade / Feature | Complexidade | Desvios do CRUD padrão |
|---|---|---|---|
| 1 | `ColumnConfig` | Média | `PUT` em lote + endpoint de detecção de colunas (sem `POST`/`DELETE` individuais) |
| 2 | `Report` | Alta | Upload multipart; sem `DELETE`; `SubmitFeedback` no lugar de `Update` |
| 3 | `ReportExecution` | Alta | Não é CRUD; criada internamente; só `GET status` e `GET download` |
| 4 | Fila de processamento | — | Celery+Redis (outro colega) |
| 5 | Aplicar entrada do dicionário em coluna (HU-08) | Baixa | `POST /projects/{id}/columns/{col}/apply-dictionary` + `DELETE` + `GET suggestions` |
| 6 | Reprocessamento | Baixa | `POST /reports/{id}/reprocess` |
| 7 | Integração com pipeline | — | `list_merged` já existe; worker precisa chamá-lo para montar contexto |
