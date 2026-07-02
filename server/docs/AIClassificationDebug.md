# Debug da Classificacao por IA

Data: 2026-06-08

Este documento registra o estado da investigacao da classificacao por IA no backend, para continuar o trabalho sem depender do historico do chat.

## Problema observado

No fluxo real do frontend e depois via `curl`, a coluna `especies_afetadas_categoria` ficava assim:

- `Outros`: 3478 linhas
- vazio: 1522 linhas
- outras categorias: 0 linhas

As 1522 linhas vazias correspondiam a linhas em que `especies_afetadas` tambem estava vazia. Ou seja: todos os valores preenchidos foram classificados como `Outros`.

No status da execucao aparecia:

```json
{
  "classification_metrics": {
    "columns": {
      "especies_afetadas": {
        "categories": ["Outros"],
        "unique_values": 851,
        "classified_ok": 0,
        "fell_to_others": 851
      }
    }
  }
}
```

Em outro teste via `curl`, a descoberta de categorias funcionou:

```json
{
  "categories": ["Mamifero", "Ave", "Reptil", "Anfibio", "Peixe", "Outros"],
  "unique_values": 851,
  "classified_ok": 0,
  "fell_to_others": 851
}
```

Mas os batches de classificacao falharam.

## Causas encontradas

### 1. Timeout no Ollama local

Logs do worker:

```text
classify batch failed for column especies_afetadas (size=50): Request timed out. -- marking as 'Outros'
```

Logs do Ollama:

```text
POST /v1/chat/completions 500 ... 1m0s
aborting completion request due to client closing the connection
```

O backend estava usando defaults do codigo, porque o `.env` nao tinha `LLM_*` explicito:

- `LLM_TIMEOUT_S=60`
- `LLM_MAX_CONCURRENCY=8`
- `LLM_SAMPLE_SIZE=300`
- `LLM_BATCH_SIZE=50`

Com Ollama local em CPU, batches de 50 valores e varias chamadas concorrentes saturavam o modelo e estouravam timeout.

### 2. Worker Celery reutilizando conexao async em event loop errado

Log do worker:

```text
RuntimeError: Task ... got Future ... attached to a different loop
RuntimeError: Event loop is closed
```

O worker Celery chama `asyncio.run(...)` por task, criando um event loop novo por execucao. A engine async do SQLAlchemy usava pool normal e podia reaproveitar conexoes `asyncpg` vinculadas a outro loop.

### 3. Polling mostrava `QUEUED` por tempo demais

O `ProcessReportUseCase` atualizava a execucao para `PROCESSING`, mas o commit so acontecia no final da task. Enquanto a task rodava por minutos, o endpoint de status ainda lia `QUEUED`.

## Correcoes aplicadas

### Config local do LLM

Arquivos:

- `.env`
- `.env.example`
- `docker-compose.yml`

Mudancas:

```env
LLM_BASE_URL=http://ollama:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.1:8b
LLM_TIMEOUT_S=180
LLM_MAX_RETRIES=3
LLM_MAX_CONCURRENCY=1
LLM_SAMPLE_SIZE=120
LLM_BATCH_SIZE=15
```

No `docker-compose.yml`:

- `worker` agora roda com `--concurrency=1`
- `worker` recebe `CELERY_WORKER=1`
- `ollama` usa `OLLAMA_NUM_PARALLEL=1`
- `ollama` usa `OLLAMA_NUM_CTX=4096`

Motivo: em dev local, estabilidade e resultado correto importam mais que throughput. Em producao com Groq/outro provedor, esses valores podem subir.

### Fix do pool async no worker

Arquivo:

- `src/infrastructure/persistence/database.py`

Mudanca:

```python
_engine_kwargs = (
    {"poolclass": NullPool}
    if os.getenv("TESTING") == "1" or os.getenv("CELERY_WORKER") == "1"
    else {"pool_pre_ping": True}
)
```

Motivo: no Celery worker, evitar reutilizacao de conexao async entre event loops.

### Commit intermediario do status PROCESSING

Arquivo:

- `src/application/reports/process_report.py`

Foi adicionado commit apos atualizar a execucao para `PROCESSING`.

Motivo: o polling deve mostrar `PROCESSING` enquanto o worker roda, nao ficar em `QUEUED` ate o fim.

### Prompt respeitando contexto do usuario

Arquivo:

- `src/application/classification/prompts.py`

Foi adicionada regra na descoberta:

```text
Se o usuario fornecer contexto, ele define o dominio e o nivel de granularidade
das categorias. Use esse contexto como prioridade sobre preferencias genericas.
```

Motivo: no exemplo do usuario, o contexto pedia tipo de animal como "cachorro" e "peixe"; o prompt antigo tendia a categorias biologicas amplas.

### Otimizacao generica por regras geradas pela IA

Arquivos:

- `src/application/classification/schemas.py`
- `src/application/classification/prompts.py`
- `src/application/classification/classify_column.py`
- `tests/unit/application/test_classify_column.py`

Foi adicionada uma etapa entre descoberta e classificacao em batch:

1. A IA descobre categorias.
2. A IA gera regras/keywords genericas para essas categorias com base em:
   - nome da coluna
   - categorias descobertas
   - amostra de valores
   - contexto do usuario
3. O backend aplica as regras localmente quando ha exatamente uma categoria candidata.
4. Valores ambiguos ou sem match continuam indo para o classificador LLM em batch.

Importante: a tentativa inicial de criar atalhos fixos para animais foi removida. A versao atual nao contem vocabulario fixo como cachorro, peixe, bovino etc. A otimizacao atual e generica e derivada pela IA para cada execucao.

Validacao feita:

```bash
rg -n "pitbull|cachorro|mamifero|bovino|animal_terms|animal_mode|LLM_CLASSIFY_MAX|preclassify" \
  src/application/classification src/infrastructure tests/unit/application/test_classify_column.py .env .env.example -S
```

Resultado: nenhum match.

## Testes ja executados

Teste unitario da classificacao:

```bash
uv run pytest tests/unit/application/test_classify_column.py -q
```

Resultado:

```text
12 passed
```

Tambem foi verificado que o worker carregou:

```text
LLM_TIMEOUT_S=180
LLM_MAX_CONCURRENCY=1
LLM_BATCH_SIZE=15
LLM_SAMPLE_SIZE=120
CELERY_WORKER=1
```

## O que ainda precisa testar

Ainda falta rodar novamente o fluxo E2E via `curl` depois da ultima versao generica por regras.

O worker foi reiniciado e a fila estava vazia antes da interrupcao:

```bash
docker compose up -d --force-recreate worker
docker compose exec redis redis-cli -n 0 llen normalizador
docker compose exec api uv run --no-dev celery -A infrastructure.worker.celery_app.celery_app inspect active
```

Esperado:

- Redis `llen normalizador` deve retornar `0`
- `inspect active` deve retornar `empty`

## Como testar via curl

Rodar na raiz do backend:

```bash
cd /home/samuka7abr/VSCODE/IDP/SPRINT/IDP-SPRINT-2026.1
```

Use a planilha reduzida:

```text
data/base_maus_tratos_5000.xlsx
```

Script manual:

```bash
set -euo pipefail

API="http://localhost:8000"
FILE="data/base_maus_tratos_5000.xlsx"
COOKIE="/tmp/normai-curl-cookies-$$.txt"
EMAIL="curl-ai-$(date +%s)@test.dev"
PASSWORD="senha123_curl"

json_field() { python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
pretty() { python3 -m json.tool 2>/dev/null || cat; }

curl -sS -f -c "$COOKIE" -H "Content-Type: application/json" \
  -X POST "$API/auth/register" \
  -d "{\"name\":\"Curl\",\"last_name\":\"AI\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | pretty

PROJECT_JSON=$(curl -sS -f -b "$COOKIE" -c "$COOKIE" -H "Content-Type: application/json" \
  -X POST "$API/projects" \
  -d '{"name":"Curl teste IA especies","description":"Teste via curl com config por coluna","ai_context":"Na coluna espécies afetadas, a classificação deve ser por tipo de animal.\nse for pitbull ou pastor alemão, deve ser classificado como cachorro, por exemplo.\nse for tilápia ou pirarucu, deve ser classificado como peixe.\ndaí por diante."}')
echo "$PROJECT_JSON" | pretty
PROJECT_ID=$(echo "$PROJECT_JSON" | json_field id)

curl -sS -f -b "$COOKIE" -c "$COOKIE" -H "Content-Type: application/json" \
  -X PUT "$API/projects/$PROJECT_ID/columns" \
  -d '[
    {"column_name":"tribunal","enabled":true,"normalizations":{"trim":true,"nulls":true,"abbreviate":true},"classify":false},
    {"column_name":"comarca","enabled":true,"normalizations":{"capitalize_pt_br":true,"nulls":true,"remove_accents":true},"classify":false},
    {"column_name":"especies_afetadas","enabled":true,"normalizations":{"trim":true,"nulls":true},"classify":true}
  ]' | pretty

UPLOAD_JSON=$(curl -sS -f -b "$COOKIE" -c "$COOKIE" \
  -X POST "$API/projects/$PROJECT_ID/reports" \
  -F "file=@$FILE;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
echo "$UPLOAD_JSON" | pretty
REPORT_ID=$(echo "$UPLOAD_JSON" | json_field report_id)
EXEC_ID=$(echo "$UPLOAD_JSON" | json_field execution_id)

STATUS_URL="$API/reports/$REPORT_ID/executions/$EXEC_ID/status?project_id=$PROJECT_ID"
for i in $(seq 1 120); do
  STATUS_JSON=$(curl -sS -f -b "$COOKIE" -c "$COOKIE" "$STATUS_URL")
  STATUS=$(echo "$STATUS_JSON" | json_field status)
  PROGRESS=$(echo "$STATUS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('progress_percent'))")
  STEP=$(echo "$STATUS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('current_step'))")
  printf "[%02d/120] status=%s progress=%s step=%s\n" "$i" "$STATUS" "$PROGRESS" "$STEP"
  if [ "$STATUS" = "READY" ] || [ "$STATUS" = "ERROR" ]; then
    break
  fi
  sleep 10
done

curl -sS -f -b "$COOKIE" -c "$COOKIE" "$STATUS_URL" | pretty

if [ "$STATUS" = "READY" ]; then
  curl -sS -f -b "$COOKIE" -c "$COOKIE" \
    "$API/reports/$REPORT_ID/executions/$EXEC_ID/download?project_id=$PROJECT_ID" | pretty
fi
```

## Como validar a planilha baixada

O endpoint de download retorna URL do LocalStack com host `localstack`. Para baixar da maquina host:

```bash
curl --fail --location --resolve localstack:4566:127.0.0.1 \
  "URL_DO_DOWNLOAD" \
  --output data/result_<EXEC_ID>.xlsx
```

Depois contar categorias:

```bash
uv run python -c "exec('''
from openpyxl import load_workbook
from collections import Counter

p = \"data/result_<EXEC_ID>.xlsx\"
wb = load_workbook(p, read_only=True, data_only=True)
ws = wb.active
headers = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
species_idx = headers.index(\"especies_afetadas\")
cat_idx = headers.index(\"especies_afetadas_categoria\")

cat_counts = Counter()
cross = Counter()
for row in ws.iter_rows(min_row=2, values_only=True):
    species = \"\" if row[species_idx] is None else str(row[species_idx]).strip()
    cat = \"\" if row[cat_idx] is None else str(row[cat_idx]).strip()
    cat_counts[cat or \"<vazio>\"] += 1
    if species and cat:
        cross[\"species_nonempty_cat_nonempty\"] += 1
    elif species and not cat:
        cross[\"species_nonempty_cat_empty\"] += 1
    elif not species and cat:
        cross[\"species_empty_cat_nonempty\"] += 1
    else:
        cross[\"species_empty_cat_empty\"] += 1

print(\"rows\", ws.max_row - 1)
print(\"category_counts\")
for k, v in cat_counts.most_common():
    print(repr(k), v)
print(\"cross\", dict(cross))
''')"
```

Sinal de sucesso:

- `classification_metrics.columns.especies_afetadas.fell_to_others` nao deve ser igual a `unique_values`
- A planilha deve ter categorias alem de `Outros`
- O polling deve sair de `QUEUED` para `PROCESSING` cedo, nao apenas no final

## Arquivos alterados nesta investigacao

Backend:

- `.env`
- `.env.example`
- `docker-compose.yml`
- `src/infrastructure/persistence/database.py`
- `src/application/reports/process_report.py`
- `src/application/classification/prompts.py`
- `src/application/classification/schemas.py`
- `src/application/classification/classify_column.py`
- `tests/unit/application/test_classify_column.py`

Arquivos de dados gerados anteriormente:

- `data/base_maus_tratos_5000.xlsx`
- `data/result_cb13d456-57d6-4106-a4c5-0b47f8076b8c.xlsx`
- `data/result_a6b2a69d-98ef-447e-a337-13513731c756.xlsx`

## Observacoes importantes

- Nao mexer no frontend ainda. O problema provado ate aqui esta no backend/worker/Ollama.
- Nao usar regras hard-coded por dominio. A feature precisa classificar qualquer coluna/tema.
- Em dev local, Ollama 8B em CPU e lento. Mesmo com os ajustes, o teste de 5000 linhas pode demorar.
- Em prod com Groq, os valores de `LLM_MAX_CONCURRENCY`, `LLM_SAMPLE_SIZE` e `LLM_BATCH_SIZE` podem ser maiores.
- Foi tentado baixar `llama3.2:1b`, mas o download estava lento demais e foi abortado.
