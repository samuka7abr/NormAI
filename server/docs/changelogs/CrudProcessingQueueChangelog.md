# Changelog — Worker de Processamento

## O que foi feito

Implementação da estrutura do worker de processamento de relatórios — ciclo de vida completo de execução (`QUEUED → PROCESSING → READY | ERROR`), interface de contrato para o processador e placeholders da integração Celery+Redis para o Samuel.

---

## O que cada parte faz

### Interface do Processador (`src/application/reports/report_processor.py`)
- `ReportProcessor` (ABC) — contrato entre o worker e a lógica de normalização/IA.
- `ProcessingResult` — dataclass de retorno: `content (bytes)`, `filename (str)`, `content_type (str)`.
- Não sabe nada sobre Celery, S3 ou banco - é pura lógica de transformação.

### Worker Use Case (`src/application/reports/process_report.py`)
- `ProcessReportUseCase` — orquestra o ciclo completo de uma execução:
  1. Busca a `ReportExecution` pelo `execution_id`.
  2. Atualiza status para `PROCESSING` + registra `started_at`.
  3. Lê o arquivo bruto do storage via `FileStorage.load_stream`.
  4. Chama `ReportProcessor.process(content, filename, column_config_snapshot)`.
  5. Salva o resultado no storage com key `{project_id}/{report_id}/result_{execution_id}.ext`.
  6. Atualiza status para `READY` + registra `result_file_key`, `finished_at`, `progress_percent=100`.
  7. Em qualquer exceção: atualiza status para `ERROR` + registra `error_log` e `finished_at`.
- A lógica de processamento está completamente isolada atrás da interface — trocar o processador não requer alterar o use case.

### Placeholder do Processador (`src/infrastructure/processor/normalization_processor.py`)
- `NormalizationProcessor` — implementação stub que retorna o arquivo original sem modificações.
- Contém comentários detalhados para o Samuel: estrutura esperada do `column_config_snapshot`, o que cada campo significa (`enabled`, `normalizations`, `classify`, `categories`), e onde conectar a implementação real.
- Funciona end-to-end agora (ciclo completa com READY) até a implementação real chegar.

### Placeholders Celery (`src/infrastructure/worker/`)
- `celery_app.py` — configuração do Celery app completamente comentada. Inclui os passos necessários: dependências a adicionar, variáveis de ambiente (`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`), e o comando para subir o worker.
- `tasks.py` — Celery task `process_report_task` completamente comentada. Inclui: montagem do use case dentro do worker, `asyncio.run()` para compatibilidade síncrona do Celery, retry automático em falha, e `CeleryProcessingQueue` pronta para substituir o `NoopProcessingQueue`.

### Métodos internos adicionados aos repositórios
- `ReportRepository.get_by_id_internal(id)` — busca sem filtro de `project_id`, necessário dentro do worker (que não tem contexto de usuário).
- `ExecutionRepository.get_by_id_no_report_check(id)` — busca sem filtro de `report_id`, pelo mesmo motivo.
- Ambos marcados no ABC e implementados em `SqlAlchemyReportRepository` e `SqlAlchemyExecutionRepository`.

---

## Como funciona (fluxo completo quando Celery estiver integrado)

```
UploadReportUseCase
    └─> cria ReportExecution(status=QUEUED)
    └─> ProcessingQueue.enqueue_execution(execution_id)
            └─> [hoje] NoopProcessingQueue — loga e descarta
            └─> [Samuel] CeleryProcessingQueue → process_report_task.delay(execution_id)

Celery Worker (processo separado)
    └─> process_report_task(execution_id)
            └─> asyncio.run(_run())
                    └─> ProcessReportUseCase.execute(execution_id)
                            └─> QUEUED → PROCESSING
                            └─> FileStorage.load_stream(original_file_key)
                            └─> NormalizationProcessor.process(...)   ← Samuel implementa aqui
                            └─> FileStorage.save(result_key, result)
                            └─> PROCESSING → READY  (ou ERROR em falha)
```

---

## Testes

- **72/72 passando** (inclui todos os testes anteriores sem regressão).
- 3 novos testes unitários do worker:
  - `QUEUED → READY`: processador bem-sucedido, `result_file_key` salvo, `progress_percent=100`.
  - `QUEUED → ERROR`: processador lança exceção, `error_log` preenchido, status `ERROR`.
  - Execução não encontrada: levanta `ReportNotFound`.

---

## O que falta

| # | Responsável | O que fazer |
|---|---|---|
| 1 | **Samuel** | Implementar `NormalizationProcessor.process()` em `infrastructure/processor/normalization_processor.py` com a lógica real de normalização + classificação IA |
| 2 | **Samuel** | Configurar Celery + Redis: descomentar `infrastructure/worker/celery_app.py`, adicionar deps (`celery>=5.3`, `redis>=5.0`) e variáveis de ambiente |
| 3 | **Samuel** | Descomentar `infrastructure/worker/tasks.py` e criar `AsyncSessionFactory` em `infrastructure/persistence/database.py` |
| 4 | **Samuel** | Substituir `NoopProcessingQueue` por `CeleryProcessingQueue` em `presentation/http/dependencies/reports.py` |
| 5 | Qualquer Posteriormente | Limpeza de S3 ao deletar projeto — `DeleteProjectUseCase` não remove arquivos do storage hoje |
| 6 | Qualquer Posteriormente | Download com conversão de formato (CSV ↔ XLSX) — hoje retorna presigned URL do formato original |
