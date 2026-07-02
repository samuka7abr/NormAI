# Changelog

---

## [Unreleased] — Activity Log (Notificações)

### O que foi feito

#### Banco de dados
- Nova tabela `activities` criada via migration `c89ed0b4ddd0_create_activities_table`:
  - Colunas: `id` (UUID PK), `user_id` (FK → `users.id` CASCADE), `project_id` (FK → `projects.id` CASCADE), `type` (VARCHAR 40), `project_name` (VARCHAR 200), `created_at` (TIMESTAMPTZ).
  - `project_name` é um snapshot do nome no momento do evento — preserva histórico mesmo se o projeto for renomeado depois.
  - Índice `idx_activities_user_created` em `(user_id, created_at)` — otimiza a query de listagem paginada por usuário.
  - Índice `idx_activities_project_id` em `(project_id)` — otimiza buscas por projeto.

#### CRUD Activity — 4 camadas (Clean Architecture)

- **Domain** (`src/domain/activity/`):
  - Entidade `Activity` (`id`, `user_id`, `project_id`, `type`, `project_name`, `created_at`).
  - Enum `ActivityType`: `project_created`, `upload`, `processing_start`, `processing_done`, `needs_action`.
  - Interface `ActivityRepository` (ABC) com `create()` e `list_by_user()`.

- **Infrastructure** (`src/infrastructure/persistence/`):
  - `ActivityModel` (SQLAlchemy): sem `TimestampMixin` pois atividades são imutáveis (só `created_at`).
  - `SqlAlchemyActivityRepository`: `create()` faz `flush` direto; `list_by_user()` usa window function `func.count().over()` para retornar total em query única — mesmo padrão do `ProjectRepository`.

- **Application** (`src/application/activity/`):
  - `ListActivitiesUseCase`: lista atividades do usuário autenticado; clampeia `limit` em 50.
  - DTOs: `ActivityOutput`, `ActivityListOutput`.

- **Presentation** (`src/presentation/http/`):
  - 1 endpoint REST: `GET /activities` com paginação por `limit`/`offset`.
  - Schema Pydantic: `ActivityResponse`, `ActivityListResponse`.
  - Dependency: `get_activity_repo`, `get_list_activities_use_case`.

#### Auto-log nos use cases existentes

| Evento | Use Case | Tipo gravado |
|--------|----------|-------------|
| Projeto criado | `CreateProjectUseCase` | `project_created` |
| Upload de arquivo | `UploadReportUseCase` | `upload` |
| Processamento enfileirado | `UploadReportUseCase` | `processing_start` |
| Processamento concluído | — (Celery não configurado) | `processing_done` *(pendente)* |
| Processamento falhou | — (Celery não configurado) | `needs_action` *(pendente)* |

`CreateProjectUseCase` e `UploadReportUseCase` passaram a receber `ActivityRepository` via injeção de dependência. As factories em `dependencies/projects.py` e `dependencies/reports.py` foram atualizadas para prover o repositório.

#### Testes (14/14 passando)
- **6 unitários** (`tests/unit/application/test_activities.py`): lista vazia, retorno com dados, isolação por `user_id`, clamp de `limit` para 50, paginação por offset, múltiplos tipos de evento.
- **8 de integração** (`tests/integration/test_activities_api.py`): 401 sem auth, lista vazia, atividade gerada após `POST /projects`, shape da resposta, paginação, isolação entre usuários, rejeição de `limit > 50`, ordenação mais recente primeiro.
- `InMemoryActivityRepository` adicionado a `tests/unit/application/_helpers.py` — compartilhado por `test_activities.py` e `test_project.py` (que agora valida que `CreateProjectUseCase` grava a atividade corretamente).

---

### Como funciona (visão geral)

```
GET /activities?limit=20&offset=0
    └─> Depends(get_current_user_id)   # extrai user_id do cookie JWT
    └─> ListActivitiesUseCase.execute(user_id, limit, offset)
            └─> SqlAlchemyActivityRepository.list_by_user()
                    └─> SELECT + COUNT(*) OVER() FROM activities
                        WHERE user_id = :uid ORDER BY created_at DESC
                        LIMIT :limit OFFSET :offset
                    └─> AsyncSession → Postgres
```

```
POST /projects  (ou upload de relatório)
    └─> CreateProjectUseCase.execute(input)
            └─> SqlAlchemyProjectRepository.create(project)   # persiste o projeto
            └─> SqlAlchemyActivityRepository.create(          # loga o evento
                    user_id, project_id,
                    type=ActivityType.project_created,
                    project_name=project.name
                )
            └─> mesma AsyncSession → commit único no final do request
```

O log de atividade e a ação principal (criação do projeto, upload) compartilham a mesma sessão SQLAlchemy — o `commit` é único ao final do request. Se o log falhar, a transação inteira faz rollback, garantindo consistência.

---

### Lista de Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/activities` | Cookie JWT | Lista atividades do usuário autenticado, ordenadas por `created_at DESC` |

**Query params:**

| Param | Tipo | Default | Máximo | Descrição |
|-------|------|---------|--------|-----------|
| `limit` | int | `20` | `50` | Quantidade de itens retornados |
| `offset` | int | `0` | — | Paginação por offset |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "project_created",
      "project_id": "uuid",
      "project_name": "Maus Tratos a Animais",
      "created_at": "2026-06-02T14:14:56Z"
    }
  ],
  "total": 42
}
```

**Tipos de evento possíveis em `type`:**

| Valor | Quando é gravado |
|-------|-----------------|
| `project_created` | Após `POST /projects` com sucesso |
| `upload` | Após upload de arquivo CSV/XLSX com sucesso |
| `processing_start` | Imediatamente após o upload ser enfileirado para processamento |
| `processing_done` | *(pendente — requer Celery configurado)* |
| `needs_action` | *(pendente — requer Celery configurado)* |

**Erros:**

| Status | Causa |
|--------|-------|
| `401` | Cookie JWT ausente ou inválido |
| `422` | `limit > 50` ou parâmetros inválidos |
