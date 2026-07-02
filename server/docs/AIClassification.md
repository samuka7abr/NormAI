# NormAI — Classificação por IA: Pipeline e Integração Frontend

> Documento sobre a feature de classificação automática (Camada 2 do PRD).
> O frontend não precisa fazer chamadas adicionais — a IA roda dentro do pipeline já existente de processamento de relatórios.
> Data: 2026-06-06

---

## TL;DR

A IA roda **dentro do processamento de relatórios já existente**, em segundo plano. O frontend continua fazendo o mesmo fluxo de sempre (criar projeto → configurar colunas → upload → polling de status → download), mas agora:

1. Quando uma coluna tem `classify: true`, o sistema **cria automaticamente** uma nova coluna no arquivo final: `<original>_categoria`.
2. O projeto tem um campo `ai_context` (texto livre) que vira instruções pra IA — bom pra dar contexto de domínio sem reconfigurar nada.
3. O endpoint de status agora devolve `classification_metrics` com as categorias descobertas e quantos valores caíram em "Outros".

Nada de endpoint novo precisa ser consumido pra fazer a feature funcionar. O frontend só precisa **exibir as métricas** e (opcionalmente) **deixar o usuário editar o `ai_context`** do projeto.

---

## 1. Arquitetura

```
Frontend
  │
  │ POST /projects (com ai_context)
  │ PUT  /projects/{id}/columns (classify=true em colunas alvo)
  │ POST /projects/{id}/reports (CSV/XLSX)
  ▼
API (FastAPI)
  │
  │ UploadReportUseCase
  │   ├─ Cria Report + ReportExecution (status=QUEUED)
  │   ├─ Snapshot da config + ai_context do projeto
  │   └─ Enfileira em Redis via CeleryProcessingQueue
  │
  ├──────── Redis (broker) ────────┐
  │                                ▼
  │                          Worker Celery
  │                            │
  │                            │ ProcessReportUseCase
  │                            │   ├─ Status: QUEUED → PROCESSING
  │                            │   ├─ Baixa arquivo do S3
  │                            │   ├─ ClassificationProcessor:
  │                            │   │     1. NormalizationProcessor (regex)
  │                            │   │     2. Para cada coluna classify=true:
  │                            │   │        ├─ Descobre categorias (1 chamada Llama)
  │                            │   │        ├─ Classifica em batches paralelos
  │                            │   │        └─ Adiciona coluna `_categoria`
  │                            │   ├─ Salva resultado no S3
  │                            │   ├─ Persiste classification_metrics no banco
  │                            │   └─ Status: PROCESSING → READY
  │                            │
  │                            └──── HTTP → Ollama (dev) / Groq (prod)
  │
  │ GET /reports/{id}/executions/{exec_id}/status  ← polling do frontend
  │ GET /reports/{id}/executions/{exec_id}/download ← presigned URL
  ▼
Frontend (renderiza métricas + baixa CSV com colunas novas)
```

---

## 2. O que foi feito

Em sub-branches isoladas:

| Bloco | Descrição | Branch |
|---|---|---|
| **A** | `LLMClient` (port + adapter OpenAI-compatible), Ollama no compose, settings | `feature/AI-infrastructure` |
| **B** | `ClassifyColumnValuesUseCase`: dedup + amostragem distribuída + descoberta + classify em batches paralelos | `feature/AI-classification-core` |
| **C** | `ClassificationProcessor`: envelopa o normalizer, adiciona coluna `<col>_categoria` | mesma |
| **D** | Endpoint `PATCH /projects/{id}` agora aceita `ai_context` (já existia, faltava chegar no pipeline) | mesma |
| **E** | Coluna `classification_metrics` no `report_executions` + migration + expose no schema HTTP | mesma |
| **F** | Testes unitários do pipeline com `FakeLLMClient` (CSV, XLSX, falhas graciosas) | mesma |
| **G** | Worker Celery ativo (era stub), `CeleryProcessingQueue`, Redis no compose, processamento async | mesma |

---

## 3. Endpoints para integrar no front

**Nenhum endpoint novo precisa ser chamado.** Só mudaram o **payload** e/ou **response** dos seguintes endpoints já existentes:

### 3.1 Projetos — agora aceitam `ai_context`

| Método | Rota | Mudança |
|---|---|---|
| `POST /projects` | request | aceita campo `ai_context: string` (opcional) |
| `PATCH /projects/{id}` | request | aceita campo `ai_context: string \| null` |
| `GET /projects/{id}` | response | sempre retorna `ai_context: string` |
| `GET /projects` | response | cada item tem `ai_context: string` |

#### Exemplo de body — POST/PATCH

```json
{
  "name": "Maus tratos a animais",
  "description": "Relatórios judiciais 2026",
  "ai_context": "Contexto: planilha de maus tratos a animais. Use categorias amplas por classe biológica (Mamíferos, Aves, Répteis, Peixes, Anfíbios). Não crie categorias por raça ou tamanho."
}
```

#### Como o frontend deve apresentar
- **Textarea livre** na tela de criar/editar projeto, com placeholder explicando que serve pra orientar a IA.
- Não é obrigatório — projeto sem `ai_context` funciona normalmente, só com instruções padrão da IA.
- Quanto mais específico, melhores as categorias inferidas.

---

### 3.2 Configuração de colunas — `classify: true`

`PUT /projects/{project_id}/columns` (sem mudança de schema, mas agora o campo `classify` **realmente faz algo**).

#### Body

```json
[
  {
    "column_name": "tribunal",
    "enabled": true,
    "normalizations": { "trim": true, "abbreviate": true },
    "classify": false
  },
  {
    "column_name": "especies",
    "enabled": true,
    "normalizations": { "trim": true },
    "classify": true,
    "categories": null
  }
]
```

#### Regras importantes
- Quando `classify: true`, o sistema **sempre infere** as categorias (não há modo "lista fornecida pelo usuário" no MVP — o `categories` é ignorado).
- A normalização determinística roda **antes** da classificação, então a IA vê os valores já normalizados.
- Vale a pena ter `trim: true` em colunas que vão classificar — evita que "Pitbull" e "Pitbull " virem categorias diferentes.

---

### 3.3 Upload — sem mudança

`POST /projects/{project_id}/reports` (multipart, campo `file`) — idêntico ao que era antes. Cria execução em `status: QUEUED` que vai pro Redis.

#### Response (sem mudança)

```json
{
  "report_id": "8cf4b84b-...",
  "execution_id": "4383719d-...",
  "original_filename": "rel.csv",
  "approval_status": "PENDING",
  "extra_columns": []
}
```

---

### 3.4 Status — **agora traz `classification_metrics`**

`GET /reports/{report_id}/executions/{execution_id}/status?project_id={id}`

Esse endpoint é o que o frontend já chama em polling (a cada ~5–10s). O response ganhou o campo `classification_metrics`.

#### Response — execução em processamento

```json
{
  "id": "799b966c-...",
  "report_id": "62fe3051-...",
  "status": "PROCESSING",
  "progress_percent": 0,
  "current_step": null,
  "started_at": "2026-06-06T14:59:42Z",
  "finished_at": null,
  "error_log": null,
  "classification_metrics": null,
  "created_at": "...",
  "updated_at": "..."
}
```

#### Response — execução concluída com classificação

```json
{
  "id": "799b966c-...",
  "report_id": "62fe3051-...",
  "status": "READY",
  "progress_percent": 100,
  "current_step": null,
  "started_at": "2026-06-06T14:59:42Z",
  "finished_at": "2026-06-06T15:00:50Z",
  "error_log": null,
  "classification_metrics": {
    "columns": {
      "especies": {
        "categories": ["Mamíferos", "Aves", "Répteis", "Outros"],
        "unique_values": 4,
        "classified_ok": 4,
        "fell_to_others": 0
      },
      "tipos_violencia": {
        "categories": ["Falta de Alimentação", "Agressão Física", "Abandono", "Outros"],
        "unique_values": 12,
        "classified_ok": 11,
        "fell_to_others": 1
      }
    }
  },
  "created_at": "...",
  "updated_at": "..."
}
```

#### Significado dos campos
- **`categories`** — lista de categorias que a IA descobriu para essa coluna. Sempre inclui `"Outros"` no final.
- **`unique_values`** — quantos valores únicos a coluna tinha (após dedup e remoção de vazios).
- **`classified_ok`** — quantos receberam uma categoria válida (incluindo "Outros" como classificação intencional do modelo).
- **`fell_to_others`** — quantos foram **forçados** a "Outros" porque a IA alucinou categoria fora da lista. Use isso pra detectar má qualidade.

#### Como o frontend deve apresentar
- Na tela de detalhes do relatório, mostrar uma seção "Classificação" com uma tabela ou card por coluna.
- Destacar a `fell_to_others`/`unique_values` em vermelho/amarelo se ratio > 15%.
- Listar as `categories` como chips.

---

### 3.5 Download — sem mudança de API, com colunas novas no arquivo

`GET /reports/{report_id}/executions/{execution_id}/download?project_id={id}`

Devolve uma presigned URL pra baixar o CSV/XLSX. **O arquivo agora tem colunas extras** — uma `<original>_categoria` pra cada coluna que tinha `classify: true`.

#### Exemplo — entrada

```csv
tribunal,especies
TJSP,Pitbull
TJSP,Pombo
```

#### Saída

```csv
tribunal,especies,especies_categoria
TJSP,Pitbull,Mamíferos
TJSP,Pombo,Aves
```

---

### 3.6 Reprocessar — também usa IA

`POST /reports/{report_id}/reprocess?project_id={id}` — sem mudança de schema, mas se a coluna tem `classify: true`, vai rodar IA na nova execução. Útil quando o usuário ajusta o `ai_context` do projeto e quer reprocessar.

---

## 4. Configuração (env vars)

### Dev (Ollama local — gratuito, mais lento)

```bash
LLM_BASE_URL=http://ollama:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.1:8b
LLM_TIMEOUT_S=60
LLM_MAX_CONCURRENCY=8
LLM_SAMPLE_SIZE=300
LLM_BATCH_SIZE=50
```

### Prod (Groq — rápido, ~$0.05/M tokens)

```bash
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=<chave-groq>
LLM_MODEL=llama-3.1-8b-instant
LLM_TIMEOUT_S=30
LLM_MAX_CONCURRENCY=8
LLM_SAMPLE_SIZE=300
LLM_BATCH_SIZE=50
```

### Celery / Redis (igual em dev e prod)

```bash
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
CELERY_TASK_DEFAULT_QUEUE=normalizador
CELERY_WORKER_MAX_RETRIES=3
CELERY_WORKER_RETRY_COUNTDOWN_S=60
```

Trocar de provedor LLM (Ollama → Groq → Together → Fireworks) é só mudar essas 3 env vars (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`). Mesma stack OpenAI-compatible serve todos.

---

## 5. Como rodar localmente

```bash
make up                 # sobe api + db + localstack + redis + worker + ollama
make migrate            # aplica a migration nova (classification_metrics)
# o ollama-pull container baixa llama3.1:8b automaticamente na primeira subida (~5min)

# fluxo via curl (script E2E pronto)
bash scripts/e2e_curl.sh
```

Comandos úteis:

```bash
make worker-logs        # acompanha o worker Celery
make queue-inspect      # mostra tasks ativas e agendadas
make llm-ping           # testa se o Ollama (ou provedor de prod) responde
make redis-cli          # abre redis-cli pra debugging
```

---

## 6. Limitações conhecidas (importantes pro front)

### 6.1 Llama 8B em CPU é lento
- Em dev (Ollama na CPU): ~60–180s por planilha pequena.
- Em prod (Groq): ~3–8s por planilha de 120k linhas.
- O polling do front continua valendo — só calibrar expectativa de tempo no UI.

### 6.2 Llama 8B erra com nomes muito específicos
Em testes, o 8B classificou alguns peixes amazônicos brasileiros (Pacu, Tucunaré, Pirarucu, Lambari) como "Mamíferos" — limitação do modelo. Em prod com Llama 3.3 70B (Groq) esse tipo de erro some.

### 6.3 Quando o LLM cai, o pipeline não quebra
Se o Ollama/Groq estiver offline:
- A execução termina com `status: READY` (não ERROR).
- Todos os valores das colunas com `classify: true` viram "Outros".
- `classification_metrics.columns.<col>.fell_to_others` reflete isso.
- O CSV final ainda é gerado, com normalização funcionando.

Isso é intencional (HU-05 do PRD — "se persistir, registra o erro e continua processando o restante"). O frontend deve **avisar o usuário** se `fell_to_others == unique_values` (ou seja, 100% caiu em Outros → provavelmente houve falha).

---

## 7. Referência cruzada — arquivos chave

| Camada | Arquivo |
|---|---|
| Port LLM | `src/domain/shared/llm_client.py` |
| Adapter OpenAI-compat | `src/infrastructure/llm/openai_compatible_client.py` |
| Use case classify | `src/application/classification/classify_column.py` |
| Prompts | `src/application/classification/prompts.py` |
| Pipeline (normalize + classify) | `src/infrastructure/processor/classification_processor.py` |
| Factory que escolhe processor | `src/infrastructure/processor/factory.py` |
| Worker Celery | `src/infrastructure/worker/celery_app.py`, `tasks.py` |
| Queue (publica jobs) | `src/infrastructure/queue/celery_queue.py` |
| Entidade com métricas | `src/domain/reports/entities.py` (`ReportExecution.classification_metrics`) |
| Migration | `migrations/versions/b7e93f1c2a05_add_classification_metrics_to_executions.py` |
| Rota afetada | `src/presentation/http/routes/reports.py` (status endpoint) |
| Schema HTTP | `src/presentation/http/schemas/reports.py` (`ExecutionStatusResponse.classification_metrics`) |

---

## 8. Checklist pro frontend

- [ ] Adicionar textarea **"Instruções pra IA"** na tela de criar/editar projeto, ligada ao campo `ai_context`.
- [ ] Na tela de configuração de colunas, deixar claro o que faz o toggle `classify`.
- [ ] Na tela de detalhes do relatório, exibir `classification_metrics.columns` quando houver — tabela com categoria, contagens, % em Outros.
- [ ] Avisar visualmente quando uma coluna teve 100% dos valores caindo em "Outros" (provável falha de LLM).
- [ ] Ajustar texto/tempo estimado do polling (a IA pode levar mais tempo que a normalização pura).
- [ ] No download, deixar o usuário entender que vão aparecer colunas novas `<original>_categoria` no CSV.
