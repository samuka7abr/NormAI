# Changelog — ColumnConfig

## O que foi feito

Implementação do CRUD especializado de `ColumnConfig` — entidade alinhada em `Project` com desvios significativos do template padrão (sem `POST`/`DELETE` individuais, `PUT` em lote, detecção de colunas via upload).

## Lógica do Desvio do Template Padrão

Colunas de uma planilha são um **conjunto coeso** — você não adiciona uma coluna por vez, você configura *todas as colunas do projeto de uma vez*, geralmente logo após o `detect`. O usuário vê a lista inteira, marca quais habilitar, configura normalização/classificação por coluna, e clica "salvar". Isso é naturalmente um PUT de toda a lista, não vários POSTs sequenciais.

#### Por que sem POST individual:
- Criaria o problema de "coluna órfã" — e se o usuário criar 3 colunas e a 4ª falhar? O banco ficaria em estado parcial.
- O `PUT` em lote é atômico: ou substitui tudo, ou não substitui nada (dentro da transação).
- Vem naturalmente do fluxo de detecção: `detect → retorna lista → usuário edita → PUT salva a lista toda`.

#### Por que sem DELETE individual:
- Coluna não existe fora do contexto do projeto. Não há "deletar coluna X mas manter o projeto" como operação de negócio — o que existe é "reconfigurar o projeto sem a coluna X", que é exatamente um `PUT` com a lista sem aquela coluna.
- Cascatear com o projeto evita limpeza manual de dados órfãos.

**O `PATCH` individual existe** porque depois que as colunas estão configuradas, o usuário pode querer mudar só um campo de uma coluna específica (ex: habilitar classificação em `cargo`) sem ter que reenviar todas as outras — isso é uma edição pontual legítima.

Em resumo: **POST/DELETE modelam entidades independentes; PUT em lote modela configuração de um conjunto que só faz sentido como todo**.

---

### Domínio (`src/domain/projects/` — mesmo módulo de Project)
- `ColumnConfig` — dataclass com `id`, `project_id`, `column_name`, `enabled`, `normalizations (dict)`, `classify`, `categories (list | None)`, `sample_values (list)`, timestamps.
- `ColumnConfigNotFound` — adicionada ao `exceptions.py` existente.
- `ColumnConfigRepository` (ABC) — adicionada ao `repositories.py` existente com `get_by_id(id, project_id)`, `list_by_project`, `upsert_all`, `update`. Sem `create` individual nem `delete` (cascade via projeto).

### Aplicação (`src/application/projects/`)
- `ConfigureColumnsUseCase` — verifica ownership do projeto, substitui todo o conjunto de colunas via `upsert_all` (semântica PUT).
- `UpdateColumnConfigUseCase` — partial update pontual de `enabled`, `normalizations`, `classify`, `categories`. `column_name` é imutável.
- `DetectColumnsUseCase` — recebe bytes + filename, delega para `ColumnDetector` (ABC), retorna estrutura sem persistir.
- `ColumnDetector` (ABC) — interface de parsing definida na camada de aplicação; implementação concreta em infraestrutura.
- DTOs adicionados ao `dtos.py` existente: `ColumnConfigInput`, `UpdateColumnConfigInput`, `ColumnConfigOutput`, `DetectedColumnOutput`.

### Infraestrutura (`src/infrastructure/`)
- `ColumnConfigModel` — tabela `column_configs` com FK `projects.id ON DELETE CASCADE`, `UNIQUE (project_id, column_name)`, índice em `project_id`.
- `SqlAlchemyColumnConfigRepository` — `upsert_all` usa DELETE + INSERT em lote (não UPSERT por linha), garantindo atomicidade da substituição.
- `SpreadsheetColumnDetector` — suporte a `.csv` (stdlib) e `.xlsx` (openpyxl). Lê até 100 linhas, coleta até 5 amostras distintas não-nulas por coluna.
- Migration: `77c0b67bce82_add_column_configs_table.py` — aplicada.

### Apresentação (`src/presentation/http/`)
- Schemas: `ColumnConfigRequest`, `UpdateColumnConfigRequest`, `ColumnConfigResponse`, `DetectedColumnResponse`.
- 4 endpoints registrados em `/projects/{project_id}/columns`.

### Dependências adicionadas
- `openpyxl>=3.1,<4.0` — leitura de XLSX.
- `python-multipart>=0.0.9,<1.0.0` — suporte a `multipart/form-data` (upload de arquivo no FastAPI).

### Testes
- **57/57 passando** (inclui todos os testes anteriores sem regressão).
- 9 testes unitários: configure OK, replace existing, project not found, clear all, update OK, update not found, detect CSV, detect skips nulls, detect empty file.

---

## Como funciona

```
Request HTTP
    └─> FastAPI route (routes/column_configs.py)
            └─> Depends(get_current_user_id)
            └─> Use Case (application/projects/)
                    └─> ProjectRepository   — verifica ownership (configure)
                    └─> ColumnConfigRepository (domain interface)
                            └─> SqlAlchemyColumnConfigRepository
                                    └─> AsyncSession → Postgres
```

### PUT em lote (idempotente)

```
PUT /projects/{id}/columns  com lista completa de colunas
    └─> ConfigureColumnsUseCase
            └─> verifica que projeto pertence ao usuário
            └─> DELETE FROM column_configs WHERE project_id = ?
            └─> INSERT todos os novos registros
            └─> retorna lista final
```

Chamar o `PUT` duas vezes com os mesmos dados produz o mesmo resultado. Colunas removidas da lista desaparecem; colunas novas são criadas; colunas existentes são recriadas com os novos valores.

### Detecção de colunas (não persiste)

```
POST /projects/{id}/columns/detect  com arquivo CSV ou XLSX
    └─> DetectColumnsUseCase
            └─> SpreadsheetColumnDetector.detect(bytes, filename)
                    ├─> .csv  → csv.DictReader (stdlib)
                    └─> .xlsx → openpyxl (load_workbook read_only)
            └─> retorna [{column_name, sample_values[]}]  — sem salvar nada
```

A persistência só ocorre quando o frontend chama o `PUT /columns` após o usuário configurar as colunas detectadas.

---

## Endpoints disponíveis

| Método | Rota | Status | Descrição |
|---|---|---|---|
| POST | `/projects/{id}/columns/detect` | 200 | Upload temporário CSV/XLSX, retorna colunas + amostras (não persiste) |
| PUT | `/projects/{id}/columns` | 200 / 404 | Substitui **todo** o conjunto de colunas do projeto |
| GET | `/projects/{id}/columns` | 200 / 404 | Lista todas as colunas configuradas |
| PATCH | `/projects/{id}/columns/{col_id}` | 200 / 404 | Edita pontualmente uma coluna |

### Formatos suportados no detect

| Extensão | Biblioteca | Observação |
|---|---|---|
| `.csv` | stdlib `csv` | Qualquer encoding UTF-8 |
| `.xlsx` | `openpyxl` | Excel 2007+. `.xls` (Excel antigo) **não suportado** |

---

## O que falta (ordem do plano)

| # | Entidade / Feature | Complexidade | Desvios do CRUD padrão |
|---|---|---|---|
| 1 | `Report` | Alta | Upload multipart; sem `DELETE`; `SubmitFeedback` no lugar de `Update` |
| 2 | `ReportExecution` | Alta | Não é CRUD; criada internamente; só `GET status` e `GET download` |
| 3 | Fila de processamento | — | Celery+Redis (outro colega) |
| 4 | Aplicar entrada do dicionário em coluna | Baixa | `POST /projects/{id}/columns/{col_id}/apply-entry/{entry_id}` |
| 5 | Reprocessamento | Baixa | `POST /reports/{id}/reprocess` |
