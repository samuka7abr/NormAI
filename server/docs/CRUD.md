# API — Endpoints Disponíveis

Referência completa de todos os endpoints da API Normalizador JusBrasil.
Toda rota (exceto `/health`, `/register`, `/login`, `/refresh`) exige autenticação via cookie `access_token` (JWT).

---

## Auth (`/`)

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `POST` | `/register` | 201 / 409 | Cria usuário e inicia sessão (define cookies `access_token` + `refresh_token`) |
| `POST` | `/login` | 200 / 401 | Autentica usuário existente (define cookies) |
| `POST` | `/refresh` | 200 / 401 | Renova `access_token` usando `refresh_token` do cookie (rotação automática) |
| `POST` | `/logout` | 200 | Revoga refresh token e limpa cookies |

---

## Usuários (`/users`)

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `GET` | `/users/me` | 200 | Retorna dados do usuário autenticado |
| `PATCH` | `/users/me/password` | 200 / 401 | Altera senha (requer senha atual) |

---

## Projetos (`/projects`)

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `POST` | `/projects` | 201 / 409 | Cria projeto (`name` único por usuário) |
| `GET` | `/projects?page=&page_size=` | 200 | Lista projetos do usuário (paginado) |
| `GET` | `/projects/{project_id}` | 200 / 404 | Busca projeto por id |
| `PATCH` | `/projects/{project_id}` | 200 / 404 / 409 | Atualiza `name`, `description` e/ou `ai_context` |
| `DELETE` | `/projects/{project_id}` | 204 / 404 | Remove projeto (cascateia `column_configs`, `reports`, `dictionary` do projeto) |

---

## Configuração de Colunas (`/projects/{project_id}/columns`)

Operações em lote — colunas são um conjunto coeso por projeto, não entidades independentes.

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `POST` | `/projects/{project_id}/columns/detect` | 200 / 404 | Upload temporário CSV ou XLSX — retorna colunas detectadas + amostras. **Não persiste.** |
| `PUT` | `/projects/{project_id}/columns` | 200 / 404 | Substitui **todo** o conjunto de colunas do projeto (idempotente) |
| `GET` | `/projects/{project_id}/columns` | 200 / 404 | Lista todas as colunas configuradas |
| `PATCH` | `/projects/{project_id}/columns/{column_id}` | 200 / 404 | Edição pontual de uma coluna (`enabled`, `normalizations`, `classify`, `categories`) |

**Observações:**
- Não existe `POST` individual nem `DELETE` individual — use o `PUT` em lote.
- `column_name` é imutável após criação via `PUT`.
- Colunas deletam junto com o projeto via `ON DELETE CASCADE`.

---

## Dicionário Global (`/dictionary`)

Entradas de dicionário do usuário, independentes de projeto.

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `POST` | `/dictionary` | 201 / 409 | Cria entrada global (`kind` + `name` únicos por usuário) |
| `GET` | `/dictionary?kind=&page=&page_size=` | 200 | Lista entradas globais (filtro opcional por `kind`) |
| `GET` | `/dictionary/{id}` | 200 / 404 | Busca entrada por id |
| `PATCH` | `/dictionary/{id}` | 200 / 404 / 409 | Atualiza `name` e/ou `payload` (`kind` imutável) |
| `DELETE` | `/dictionary/{id}` | 204 / 404 | Remove entrada |

---

## Dicionário de Projeto (`/projects/{project_id}/dictionary`)

Entradas de dicionário escopadas a um projeto. Têm precedência sobre o dicionário global em conflitos de `(kind, name)`.

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `POST` | `/projects/{project_id}/dictionary` | 201 / 409 | Cria entrada no dicionário do projeto |
| `GET` | `/projects/{project_id}/dictionary?kind=&page=&page_size=` | 200 | Lista entradas do projeto |
| `GET` | `/projects/{project_id}/dictionary/{id}` | 200 / 404 | Busca entrada por id |
| `PATCH` | `/projects/{project_id}/dictionary/{id}` | 200 / 404 / 409 | Atualiza `name` e/ou `payload` |
| `DELETE` | `/projects/{project_id}/dictionary/{id}` | 204 / 404 | Remove entrada |

**`kind` disponíveis:** `NORMALIZATION_PRESET` · `CATEGORY_LIST` · `CLASSIFICATION_INSTRUCTION`

---

## Relatórios (`/projects/{project_id}/reports` e `/reports`)

Sem `DELETE` — histórico de relatórios é imutável. Criação é por upload multipart.

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `POST` | `/projects/{project_id}/reports` | 200 / 404 / 409 / 422 | Upload multipart CSV ou XLSX. Valida colunas contra config do projeto. Cria `Report` + `ReportExecution(QUEUED)`. |
| `GET` | `/projects/{project_id}/reports?page=&page_size=` | 200 / 404 | Lista relatórios do projeto com status da última execução |
| `GET` | `/reports/{report_id}?project_id=` | 200 / 404 | Relatório completo com todas as execuções |
| `GET` | `/reports/{report_id}/executions/{execution_id}/status?project_id=` | 200 / 404 | Polling de progresso de uma execução |
| `GET` | `/reports/{report_id}/executions/{execution_id}/download?project_id=` | 200 / 404 / 409 | Presigned URL para download do resultado (exige `status=READY`) |
| `POST` | `/reports/{report_id}/reprocess?project_id=` | 200 / 404 | Cria nova execução com snapshot da config atual, reutiliza arquivo original |
| `PATCH` | `/reports/{report_id}/feedback?project_id=` | 200 / 404 / 409 | Aprova ou rejeita relatório (`PENDING → APPROVED\|REJECTED`) |

**Códigos 409 em relatórios:**
- Upload: colunas obrigatórias (habilitadas na config) ausentes no arquivo (`ColumnsMismatch`).
- Download: execução ainda não está `READY` (`ReportNotReady`).
- Feedback: transição de status inválida (`InvalidApprovalTransition`).

**Ciclo de vida de uma execução:** `QUEUED → PROCESSING → READY | ERROR`

---

## Health

| Método | Rota | Status | Descrição |
|---|---|---|---|
| `GET` | `/health` | 200 | Verificação de disponibilidade da API |

---

## Resumo por domínio

| Domínio | Endpoints | Autenticação |
|---|---|---|
| Auth | 4 | Não (exceto `/logout`) |
| Usuários | 2 | Sim |
| Projetos | 5 | Sim |
| Colunas | 4 | Sim |
| Dicionário Global | 5 | Sim |
| Dicionário de Projeto | 5 | Sim |
| Relatórios | 7 | Sim |
| Health | 1 | Não |
| **Total** | **33** | |

---

## O que ainda falta implementar

| # | Feature | Rota prevista | Responsável |
|---|---|---|---|
| 1 | Aplicar entrada do dicionário em coluna | `POST /projects/{id}/columns/{col_id}/apply-entry/{entry_id}` | Qualquer |
| 2 | Integração Celery+Redis (fila real) | — | Samuel |
| 3 | Worker de normalização + IA | — | Samuel |
| 4 | Limpeza de S3 ao deletar projeto | — | Qualquer |
| 5 | Download com conversão CSV ↔ XLSX | `GET .../download?format=csv\|xlsx` | Qualquer |
