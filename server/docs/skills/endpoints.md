---
name: endpoints
description: Skill para desenvolvimento backend — entende todos os endpoints, convenções e padrões da API Normalizador JusBrasil.
---

Você está trabalhando na API **Normalizador JusBrasil** (FastAPI + SQLAlchemy async + Postgres).

## Arquitetura

Clean Architecture em 4 camadas obrigatórias:

```
domain  →  application  →  infrastructure  →  presentation
```

- `domain`: dataclasses, enums, ABCs de repositório, exceções. Zero imports externos.
- `application`: use cases, DTOs (`@dataclass`). Zero imports de FastAPI ou SQLAlchemy.
- `infrastructure`: modelos SQLAlchemy, repositórios concretos, storage S3, fila.
- `presentation`: schemas Pydantic, dependencies FastAPI, rotas.

Nunca cortar camadas. Use case recebe e retorna DTOs ou entidades de domínio, nunca modelos SQLAlchemy ou schemas Pydantic.

## Convenções consolidadas

- Repositórios: sempre `ABC`. Métodos `async`. `get_by_id` e `delete` recebem `user_id` para isolamento multi-tenant.
- Paginação: `page` (≥1) + `page_size` (1–100). `offset = (page-1) * page_size`. Total via `func.count().over()` em query única.
- Exceções de domínio → HTTP: `NotFound → 404`, `AlreadyExists → 409`, `ValueError/ColumnsMismatch → 409 ou 422`.
- Modelos SQLAlchemy: herdam `Base` + `TimestampMixin`. FK com `ondelete="CASCADE"`. Método `_to_entity()` no modelo.
- Índices únicos parciais (WHERE): usar `Index(..., unique=True, postgresql_where=text(...))`, não `UniqueConstraint` com `postgresql_where`.
- Testes unitários: fakes em memória no próprio arquivo de teste. Sem mocks. `asyncio_mode = "auto"`.
- Sem comentários de "o quê" — só "por quê" quando não óbvio.

## Endpoints disponíveis (33 no total)

### Auth (sem autenticação)
| Método | Rota | Status |
|---|---|---|
| POST | `/register` | 201 / 409 |
| POST | `/login` | 200 / 401 |
| POST | `/refresh` | 200 / 401 |
| POST | `/logout` | 200 |

### Usuários
| Método | Rota | Status |
|---|---|---|
| GET | `/users/me` | 200 |
| PATCH | `/users/me/password` | 200 / 401 |

### Projetos
| Método | Rota | Status |
|---|---|---|
| POST | `/projects` | 201 / 409 |
| GET | `/projects?page=&page_size=` | 200 |
| GET | `/projects/{project_id}` | 200 / 404 |
| PATCH | `/projects/{project_id}` | 200 / 404 / 409 |
| DELETE | `/projects/{project_id}` | 204 / 404 |

### Configuração de Colunas
Sem POST/DELETE individual — colunas são um conjunto coeso, só `PUT` em lote.
| Método | Rota | Status |
|---|---|---|
| POST | `/projects/{project_id}/columns/detect` | 200 — não persiste |
| PUT | `/projects/{project_id}/columns` | 200 / 404 — substitui tudo |
| GET | `/projects/{project_id}/columns` | 200 / 404 |
| PATCH | `/projects/{project_id}/columns/{column_id}` | 200 / 404 |

### Dicionário Global
| Método | Rota | Status |
|---|---|---|
| POST | `/dictionary` | 201 / 409 |
| GET | `/dictionary?kind=&page=&page_size=` | 200 |
| GET | `/dictionary/{id}` | 200 / 404 |
| PATCH | `/dictionary/{id}` | 200 / 404 / 409 |
| DELETE | `/dictionary/{id}` | 204 / 404 |

### Dicionário de Projeto
Mesmo CRUD, escopado. Entradas de projeto têm precedência sobre global em conflitos de `(kind, name)`.
| Método | Rota | Status |
|---|---|---|
| POST | `/projects/{project_id}/dictionary` | 201 / 409 |
| GET | `/projects/{project_id}/dictionary?kind=&page=&page_size=` | 200 |
| GET | `/projects/{project_id}/dictionary/{id}` | 200 / 404 |
| PATCH | `/projects/{project_id}/dictionary/{id}` | 200 / 404 / 409 |
| DELETE | `/projects/{project_id}/dictionary/{id}` | 204 / 404 |

### Relatórios
Sem DELETE. Criação por upload multipart. `project_id` como query param nas rotas `/reports/...`.
| Método | Rota | Status |
|---|---|---|
| POST | `/projects/{project_id}/reports` | 200 / 404 / 409 / 422 |
| GET | `/projects/{project_id}/reports?page=&page_size=` | 200 / 404 |
| GET | `/reports/{report_id}?project_id=` | 200 / 404 |
| GET | `/reports/{report_id}/executions/{execution_id}/status?project_id=` | 200 / 404 |
| GET | `/reports/{report_id}/executions/{execution_id}/download?project_id=` | 200 / 404 / 409 |
| POST | `/reports/{report_id}/reprocess?project_id=` | 200 / 404 |
| PATCH | `/reports/{report_id}/feedback?project_id=` | 200 / 404 / 409 |

### Health
| Método | Rota | Status |
|---|---|---|
| GET | `/health` | 200 |

## Estrutura de arquivos por domínio

```
src/
  domain/
    projects/      entities.py, exceptions.py, repositories.py   (Project + ColumnConfig)
    reports/       entities.py, exceptions.py, repositories.py   (Report + ReportExecution)
    dictionary/    entities.py, exceptions.py, repositories.py
    shared/        file_storage.py, processing_queue.py

  application/
    projects/      dtos.py, create_project.py, get_project.py, list_projects.py,
                   update_project.py, delete_project.py,
                   configure_columns.py, update_column_config.py, detect_columns.py,
                   report_processor.py
    reports/       dtos.py, upload_report.py, list_reports.py, get_report.py,
                   get_execution_status.py, download_result.py, submit_feedback.py,
                   reprocess_report.py, process_report.py, report_processor.py
    dictionary/    dtos.py, create_entry.py, list_entries.py, get_entry.py,
                   update_entry.py, delete_entry.py

  infrastructure/
    persistence/
      models/      project.py, column_config.py, report.py, dictionary.py, user.py, auth.py
      repositories/ project_repository.py, column_config_repository.py,
                    report_repository.py, execution_repository.py, dictionary_repository.py
    storage/       s3_file_storage.py
    queue/         noop_queue.py   (stub — Celery+Redis pendente, Samuel)
    processor/     normalization_processor.py   (stub — IA pendente, Samuel)
    worker/        celery_app.py, tasks.py   (comentado — Samuel conecta)
    spreadsheet/   column_detector.py

  presentation/http/
    routes/        auth.py, users.py, projects.py, column_configs.py,
                   reports.py, dictionary.py
    schemas/       projects.py, column_configs.py, reports.py, dictionary.py
    dependencies/  auth.py, container.py, projects.py, reports.py, dictionary.py
```

## Padrão de implementação de um novo endpoint

1. **Domínio** — adicionar exceção em `exceptions.py` se necessário.
2. **Aplicação** — novo use case em arquivo separado, DTO no `dtos.py` do módulo.
3. **Infraestrutura** — novo método no repositório ABC + implementação SQLAlchemy.
4. **Apresentação** — schema Pydantic → dependency → rota → registrar em `app.py`.
5. **Testes** — fake do repositório + cenários OK e erro no arquivo `tests/unit/application/test_<modulo>.py`.
6. **Migration** — `make migration MSG="descricao"` → revisar → `make migrate`.
7. **Verificação** — `make test` (deve passar tudo).

## O que ainda não existe (próximos endpoints)

| Feature | Rota | Observação |
|---|---|---|
| Aplicar entrada do dicionário em coluna | `POST /projects/{id}/columns/{col_id}/apply-entry/{entry_id}` | Merge `payload` do dicionário na `ColumnConfig` conforme `kind` |
| Download com conversão de formato | `GET .../download?format=csv\|xlsx` | Conversão on-the-fly |
| Limpeza de S3 ao deletar projeto | — | `DeleteProjectUseCase` não remove arquivos do storage hoje |
| Integração Celery+Redis | — | Samuel — ver `docs/changelogs/CrudProcessingQueue.md` |
| Worker de normalização + IA | — | Samuel — ver `infrastructure/processor/normalization_processor.py` |
