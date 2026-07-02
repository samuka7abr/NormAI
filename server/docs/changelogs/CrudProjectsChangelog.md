# Changelog

---

## [Unreleased] — CRUD Project + Infraestrutura de Persistência

### O que foi feito

#### Infraestrutura de banco de dados
- `SQLAlchemy 2.x async` + `asyncpg` como driver Postgres.
- `Base` + `TimestampMixin` (`created_at`, `updated_at`) reutilizáveis por todos os modelos.
- `get_db()` dependency que faz `commit` automático no sucesso e `rollback` em exceção.
- `Alembic` configurado com `env.py` assíncrono. Migration `add_users_auth_and_projects_tables` cria as 3 tabelas iniciais (`users`, `refresh_tokens`, `projects`) com todos os índices e constraints.
- `docker-compose.yml`: Postgres 16 com healthcheck; volumes para `src/`, `tests/`, `migrations/`.
- `Makefile` com `make migration MSG=...` e `make migrate` executando dentro do container.

#### Auth — repositórios migrados de in-memory para SQLAlchemy
- `SqlAlchemyUserRepository`: `save` (upsert por id), `find_by_id`, `find_by_email`, `exists_by_email`.
- `SqlAlchemyRefreshTokenRepository`: `save` (upsert), `find_by_hash`, `revoke_all_for_user`.
- `container.py` atualizado para injetar os repositórios SQLAlchemy via `Depends(get_db)`.

#### CRUD Project — 5 layers (Clean Architecture)
- **Domain** (`src/domain/projects/`): entidade `Project` (`id`, `user_id`, `name`, `description`, `ai_context`, timestamps), exceções `ProjectNotFound` / `ProjectNameAlreadyExists`, interface `ProjectRepository` (ABC).
- **Application** (`src/application/projects/`): DTOs + 5 use cases (`Create`, `Get`, `List`, `Update`, `Delete`). Paginação com `ceil(total / page_size)`.
- **Infrastructure** (`src/infrastructure/persistence/`): `ProjectModel` com `UniqueConstraint(user_id, name)` e índices em `user_id` e `created_at`; `SqlAlchemyProjectRepository` usando window function `func.count().over()` para total em query única.
- **Presentation** (`src/presentation/http/`): 5 endpoints REST (`POST /projects` 201, `GET /projects` paginado, `GET /projects/{id}`, `PATCH /projects/{id}`, `DELETE /projects/{id}` 204). Exceções mapeadas para HTTP (404 / 409 / 422).
- **Testes** (21/21 passando): 11 testes unitários com `InMemoryProjectRepository`; 9 testes de integração com Postgres real (criação, listagem, busca, atualização, deleção, isolamento entre usuários, paginação).

#### Configuração de testes
- `pytest-asyncio` com `asyncio_mode = "auto"` (pyproject.toml baked na imagem via `make rebuild`).
- `tests/conftest.py` define `TESTING=1` antes dos imports.
- `database.py` usa `NullPool` quando `TESTING=1` — resolve o erro _"Future attached to a different loop"_ do asyncpg.

### Como funciona (visão geral)

```
Request HTTP
    └─> FastAPI route  (presentation/http/routes/)
            └─> Depends(get_current_user_id)   # valida JWT do cookie
            └─> Use Case (application/projects/)
                    └─> ProjectRepository (domain interface)
                            └─> SqlAlchemyProjectRepository (infrastructure)
                                    └─> AsyncSession → Postgres
```

Cada camada só conhece a camada imediatamente abaixo via interface. O `get_db()` gerencia a transação: um `commit` por request bem-sucedido, `rollback` automático em qualquer exceção.

### Storage e Fila (infraestrutura preparada, não integrada ao CRUD ainda)
- `S3FileStorage` (`infrastructure/storage/`) implementando `FileStorage` do domínio. Suporta `AWS_S3_ENDPOINT_URL` para LocalStack em dev.
- `ProcessingQueue` (ABC no domínio) — implementação Celery+Redis pendente (Samuel).

---

## O que falta (ordem do plano)

| # | Entidade / Feature | Complexidade | Desvios do CRUD padrão |
|---|---|---|---|
| 1 | `DictionaryEntry` | Média | Dois escopos (global `/dictionary` e por projeto `/projects/{id}/dictionary`); `list_merged` para pipeline; projeto tem precedência em conflitos de `(kind, name)` |
| 2 | `ColumnConfig` | Média | `PUT` em lote + endpoint de detecção de colunas (sem `POST`/`DELETE` individuais) |
| 3 | `Report` | Alta | Upload multipart; sem `DELETE`; `SubmitFeedback` no lugar de `Update` |
| 4 | `ReportExecution` | Alta | Não é CRUD; criada internamente; só `GET status` e `GET download` |
| 5 | Fila de processamento | — | Celery+Redis (Samuel) |
| 6 | Aplicar entrada do dicionário em coluna | Baixa | `POST /projects/{id}/columns/{col_id}/apply-entry/{entry_id}` |
| 7 | Reprocessamento | Baixa | `POST /reports/{id}/reprocess` |
