# Changelog — Report & ReportExecution

## O que foi feito

Implementação do CRUD especializado de `Report` e `ReportExecution` — entidades com desvios significativos do template padrão: criação por upload multipart, sem `DELETE`, `SubmitFeedback` no lugar de `Update`, e `ReportExecution` não é CRUD (criada internamente, só leitura/download externos).

## Lógica do Desvio do Template Padrão

#### Por que criação via upload multipart e não JSON:
- Um relatório **é** o arquivo — não faz sentido criar o registro sem o conteúdo. O upload e a criação são a mesma operação.
- Validar colunas contra a config do projeto antes de salvar no S3 evita lixo no storage em caso de erro.

#### Por que sem DELETE:
- Histórico de relatórios tem valor jurídico. Deletar um relatório aprovado destruiria rastreabilidade.
- No MVP, o ciclo de vida do relatório termina em `APPROVED` ou `REJECTED`.

#### Por que `SubmitFeedback` no lugar de `Update`:
- `Update` seria um campo genérico aberto — mas a única transição de estado de negócio permitida é `PENDING → APPROVED | REJECTED`.
- `SubmitFeedbackUseCase` encapsula a state machine de aprovação e rejeita transições inválidas com `InvalidApprovalTransition` (ex: tentar rejeitar um relatório já aprovado).

#### Por que `ReportExecution` não é CRUD:
- Execução não é criada pelo usuário — nasce dentro de `UploadReportUseCase` (status `QUEUED`) e dentro de `ReprocessReportUseCase`.
- O worker é o único que atualiza o estado da execução (`PROCESSING → READY | ERROR`).
- O usuário só faz leitura: polling de status e download do resultado.

#### Por que snapshot da config na execução:
- A config de colunas pode mudar entre execuções. Guardar o snapshot no momento da criação garante rastreabilidade histórica — uma execução antiga sempre sabe com qual config foi rodada.

#### Por que `ColumnsMismatch` antes do S3:
- Falhar rápido antes de salvar o arquivo evita objetos órfãos no storage.
- Colunas **faltando** na config habilitada → `409` (bloqueante: o processador não saberia o que fazer).
- Colunas **extras** no arquivo → aceitas com aviso (`extra_columns` na resposta), o processador ignora.

---

### Domínio (`src/domain/reports/`)
- `Report` — dataclass com `id`, `project_id`, `original_filename`, `original_file_key`, `uploaded_at`, `approval_status (ApprovalStatus)`, `approval_reason (str | None)`, timestamps.
- `ReportExecution` — dataclass com `id`, `report_id`, `status (ExecutionStatus)`, `progress_percent`, `current_step`, `started_at`, `finished_at`, `result_file_key`, `error_log`, `column_config_snapshot (dict)`, timestamps.
- `ApprovalStatus` — enum: `PENDING | APPROVED | REJECTED`.
- `ExecutionStatus` — enum: `QUEUED | PROCESSING | READY | ERROR`.
- `ReportNotFound`, `ColumnsMismatch`, `ReportNotReady`, `InvalidApprovalTransition` — em `exceptions.py`.
- `ReportRepository` (ABC) — `create`, `get_by_id(id, project_id)`, `list_by_project(project_id, offset, limit)`, `update`.
- `ExecutionRepository` (ABC) — `create`, `get_by_id(id, report_id)`, `list_by_report`, `get_latest_by_report`, `update`.

### Aplicação (`src/application/reports/`)
- `UploadReportUseCase` — valida tamanho (limite configurável via `max_upload_size_mb`), lê cabeçalho CSV/XLSX, compara com colunas habilitadas do projeto, levanta `ColumnsMismatch` se faltar coluna, salva no storage, cria `Report` + `ReportExecution(status=QUEUED)` com snapshot da config atual, publica job via `ProcessingQueue`.
- `ListReportsUseCase` — paginado, enriquece cada item com o status e ID da execução mais recente.
- `GetReportUseCase` — retorna o relatório com todas as execuções ordenadas por `created_at desc`.
- `GetExecutionStatusUseCase` — polling de uma execução específica.
- `DownloadResultUseCase` — exige `status=READY`, retorna presigned URL via `FileStorage`.
- `SubmitFeedbackUseCase` — aplica state machine `PENDING → APPROVED | REJECTED`; rejeita outras transições.
- `ReprocessReportUseCase` — cria nova `ReportExecution` com snapshot da config **atual**, reutiliza `original_file_key` (não re-faz upload), publica na fila. Execuções antigas permanecem acessíveis.
- DTOs em `dtos.py`: `UploadReportInput`, `SubmitFeedbackInput`, `ReportOutput`, `ReportWithLatestExecutionOutput`, `ExecutionOutput`, `UploadReportOutput`, `PaginatedReportsOutput`, `ReportDetailOutput`.

### Infraestrutura (`src/infrastructure/`)
- `ReportModel` — tabela `reports` com FK `projects.id ON DELETE CASCADE`, índices em `project_id` e `uploaded_at`.
- `ReportExecutionModel` — tabela `report_executions` com FK `reports.id ON DELETE CASCADE`, índice em `report_id`, JSONB para `column_config_snapshot`.
- `SqlAlchemyReportRepository` — `list_by_project` usa window function `func.count().over()` para total em query única.
- `SqlAlchemyExecutionRepository` — `get_latest_by_report` ordena por `created_at desc limit 1`.
- `NoopProcessingQueue` — stub no-op que loga o `execution_id`; substituir pela integração Celery+Redis quando disponível.
- Migration: `4df85356b0f8_add_reports_and_executions_tables.py` — aplicada.

### Apresentação (`src/presentation/http/`)
- Schemas: `UploadReportResponse`, `ReportResponse`, `ReportListItemResponse`, `PaginatedReportsResponse`, `ExecutionStatusResponse`, `ReportDetailResponse`, `SubmitFeedbackRequest`.
- 7 endpoints registrados.

---

## Como funciona

```
Request HTTP
    └─> FastAPI route (routes/reports.py)
            └─> Depends(get_current_user_id)
            └─> Use Case (application/reports/)
                    ├─> ProjectRepository     — verifica ownership (upload, list)
                    ├─> ColumnConfigRepository — lê colunas habilitadas (upload, reprocess)
                    ├─> ReportRepository      — domain interface
                    │       └─> SqlAlchemyReportRepository
                    │               └─> AsyncSession → Postgres
                    ├─> ExecutionRepository   — domain interface
                    │       └─> SqlAlchemyExecutionRepository
                    ├─> FileStorage           — S3FileStorage (boto3/aioboto3)
                    └─> ProcessingQueue       — NoopProcessingQueue (stub)
```

### Fluxo de upload

```
POST /projects/{project_id}/reports  multipart/form-data
    └─> UploadReportUseCase
            └─> valida tamanho (≤ max_upload_size_mb)
            └─> lê cabeçalho do arquivo
            └─> compara colunas com config habilitada do projeto
                    ├─> faltando → ColumnsMismatch (409)
                    └─> extras   → aceitos, listados em extra_columns
            └─> FileStorage.save(key, bytes)
            └─> cria Report (approval_status=PENDING)
            └─> cria ReportExecution (status=QUEUED, snapshot=config_atual)
            └─> ProcessingQueue.enqueue_execution(execution_id)
            └─> retorna {report_id, execution_id, extra_columns}
```

### Fluxo de reprocessamento

```
POST /reports/{report_id}/reprocess
    └─> ReprocessReportUseCase
            └─> busca Report existente
            └─> captura snapshot da config atual
            └─> cria nova ReportExecution (status=QUEUED, reutiliza original_file_key)
            └─> ProcessingQueue.enqueue_execution(novo_execution_id)
            └─> retorna nova ExecutionOutput
```

### Fluxo de feedback

```
PATCH /reports/{report_id}/feedback
    └─> SubmitFeedbackUseCase
            └─> verifica que report existe
            └─> valida transição: PENDING → APPROVED | REJECTED
            └─> persiste novo status + razão
```

---

## Endpoints disponíveis

| Método | Rota | Status HTTP | Descrição |
|---|---|---|---|
| `POST` | `/projects/{project_id}/reports` | 200 / 404 / 409 / 422 | Upload multipart CSV ou XLSX |
| `GET` | `/projects/{project_id}/reports` | 200 / 404 | Lista paginada com status da última execução |
| `GET` | `/reports/{report_id}?project_id=` | 200 / 404 | Relatório + todas as execuções |
| `GET` | `/reports/{report_id}/executions/{exec_id}/status?project_id=` | 200 / 404 | Polling de progresso da execução |
| `GET` | `/reports/{report_id}/executions/{exec_id}/download?project_id=` | 200 / 404 / 409 | Presigned URL para download (exige `READY`) |
| `POST` | `/reports/{report_id}/reprocess?project_id=` | 200 / 404 | Cria nova execução com config atual |
| `PATCH` | `/reports/{report_id}/feedback?project_id=` | 200 / 404 / 409 | Aprova ou rejeita relatório |

### Códigos de erro relevantes

| Código | Situação |
|---|---|
| 404 | Report, execução ou projeto não encontrado |
| 409 | Colunas faltando no arquivo (`ColumnsMismatch`), execução não está `READY` (`ReportNotReady`), transição de aprovação inválida (`InvalidApprovalTransition`) |
| 422 | Arquivo excede o limite de tamanho |

---

## Testes

- **69/69 passando** (inclui todos os testes anteriores sem regressão).
- 12 testes unitários de Report:
  - upload OK, upload com `ColumnsMismatch` (faltando coluna), upload com colunas extras (permitido), upload projeto não encontrado, upload excede tamanho
  - feedback aprovar OK, feedback transição inválida, feedback relatório não encontrado
  - download OK (presigned URL), download sem `READY` (`ReportNotReady`)
  - reprocessar OK (nova execução criada), reprocessar relatório não encontrado

---

## O que falta (ordem do plano)

| # | Entidade / Feature | Complexidade | Observação |
|---|---|---|---|
| 1 | Integração Celery+Redis | — | Substituir `NoopProcessingQueue`; A Cargo do Samuel |
| 2 | Worker de processamento | Alta | Consome fila, atualiza `ExecutionStatus`, salva `result_file_key` |
| 3 | Aplicar entrada do dicionário em coluna | Baixa | `POST /projects/{id}/columns/{col_id}/apply-entry/{entry_id}` |
| 4 | Limpeza de S3 ao deletar projeto | Baixa | `DeleteProjectUseCase` não apaga arquivos no storage hoje |
| 5 | Download com conversão de formato (CSV ↔ XLSX) | Média | Atualmente retorna presigned URL do formato original |
