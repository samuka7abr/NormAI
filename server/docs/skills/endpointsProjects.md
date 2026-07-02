---
name: endpointsProjects
description: Endpoints, convenções e padrões de Projetos, Configuração de Colunas e Relatórios da API Normalizador JusBrasil.
---

Você está trabalhando na API **Normalizador JusBrasil** (FastAPI + SQLAlchemy async + Postgres).

## Projetos

| Método | Rota | Status |
|---|---|---|
| POST | `/projects` | 201 / 409 |
| GET | `/projects?page=&page_size=` | 200 |
| GET | `/projects/{project_id}` | 200 / 404 |
| PATCH | `/projects/{project_id}` | 200 / 404 / 409 |
| DELETE | `/projects/{project_id}` | 204 / 404 |

## Configuração de Colunas

Sem POST/DELETE individual — colunas são um conjunto coeso, só `PUT` em lote.

| Método | Rota | Status |
|---|---|---|
| POST | `/projects/{project_id}/columns/detect` | 200 — não persiste |
| PUT | `/projects/{project_id}/columns` | 200 / 404 — substitui tudo |
| GET | `/projects/{project_id}/columns` | 200 / 404 |
| PATCH | `/projects/{project_id}/columns/{column_id}` | 200 / 404 |

## Relatórios

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

## Estrutura de arquivos relevante

```
src/
  domain/
    projects/      entities.py, exceptions.py, repositories.py   (Project + ColumnConfig)
    reports/       entities.py, exceptions.py, repositories.py   (Report + ReportExecution)

  application/
    projects/      dtos.py, create_project.py, get_project.py, list_projects.py,
                   update_project.py, delete_project.py,
                   configure_columns.py, update_column_config.py, detect_columns.py,
                   report_processor.py
    reports/       dtos.py, upload_report.py, list_reports.py, get_report.py,
                   get_execution_status.py, download_result.py, submit_feedback.py,
                   reprocess_report.py, process_report.py, report_processor.py

  infrastructure/
    persistence/
      models/      project.py, column_config.py, report.py
      repositories/ project_repository.py, column_config_repository.py,
                    report_repository.py, execution_repository.py
    storage/       s3_file_storage.py
    queue/         noop_queue.py
    processor/     normalization_processor.py
    worker/        celery_app.py, tasks.py
    spreadsheet/   column_detector.py

  presentation/http/
    routes/        projects.py, column_configs.py, reports.py
    schemas/       projects.py, column_configs.py, reports.py
    dependencies/  projects.py, reports.py
```
