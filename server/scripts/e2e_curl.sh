#!/usr/bin/env bash
# E2E pipeline test via HTTP:
#   register → create project (com ai_context) → PUT column configs
#   → POST upload CSV → polling status → mostra classification_metrics
set -euo pipefail

API="${API:-http://localhost:8000}"
EMAIL="e2e+$(date +%s)@test.dev"
PASSWORD="senha123_e2e"
COOKIES=$(mktemp)
trap 'rm -f "$COOKIES" /tmp/e2e_input.csv' EXIT

say() { printf "\n\033[1;34m== %s ==\033[0m\n" "$*"; }
json() { python3 -m json.tool 2>/dev/null || cat; }

# Pequeno CSV de teste com especies (será classificada) + tribunal (só normalizado)
cat > /tmp/e2e_input.csv <<'EOF'
tribunal,especies
Tribunal de Justiça do Estado de São Paulo TJSP,Pitbull
TJSP,Pombo
tribunal de justiça do estado de são paulo,Galgo Inglês
TJSP,Pitbull
TJSP,Papagaio
EOF

say "1. Register"
curl -sS -c "$COOKIES" -H "Content-Type: application/json" \
  -X POST "$API/auth/register" \
  -d "{\"name\":\"E2E\",\"last_name\":\"Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | json

say "2. Create project (com ai_context)"
PROJECT_JSON=$(curl -sS -b "$COOKIES" -c "$COOKIES" -H "Content-Type: application/json" \
  -X POST "$API/projects" \
  -d '{"name":"E2E Maus tratos","description":"E2E pipeline test","ai_context":"Contexto: planilha de maus tratos a animais. Use categorias amplas por classe biológica (Mamíferos, Aves, Répteis)."}')
echo "$PROJECT_JSON" | json
PROJECT_ID=$(echo "$PROJECT_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "project_id=$PROJECT_ID"

say "3. Configure columns (PUT bulk — normaliza tribunal, classifica especies)"
curl -sS -b "$COOKIES" -c "$COOKIES" -H "Content-Type: application/json" \
  -X PUT "$API/projects/$PROJECT_ID/columns" \
  -d '[
    {"column_name":"tribunal","enabled":true,"normalizations":{"trim":true,"abbreviate":true},"classify":false},
    {"column_name":"especies","enabled":true,"normalizations":{"trim":true},"classify":true}
  ]' | json

say "4. Upload report"
UPLOAD_JSON=$(curl -sS -b "$COOKIES" -c "$COOKIES" \
  -X POST "$API/projects/$PROJECT_ID/reports" \
  -F "file=@/tmp/e2e_input.csv;type=text/csv")
echo "$UPLOAD_JSON" | json
REPORT_ID=$(echo "$UPLOAD_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['report_id'])")
EXEC_ID=$(echo "$UPLOAD_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['execution_id'])")
echo "report_id=$REPORT_ID  execution_id=$EXEC_ID"

say "5. Polling status (até READY/ERROR ou 8min)"
STATUS_URL="$API/reports/$REPORT_ID/executions/$EXEC_ID/status?project_id=$PROJECT_ID"
for i in $(seq 1 48); do
  STATUS_JSON=$(curl -sS -b "$COOKIES" -c "$COOKIES" "$STATUS_URL")
  STATUS=$(echo "$STATUS_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
  printf "[%02d/48] status=%s\n" "$i" "$STATUS"
  if [ "$STATUS" = "READY" ] || [ "$STATUS" = "ERROR" ]; then
    break
  fi
  sleep 10
done

say "6. Final status (com classification_metrics)"
curl -sS -b "$COOKIES" -c "$COOKIES" "$STATUS_URL" | json

if [ "$STATUS" = "READY" ]; then
  say "7. Download presigned URL"
  curl -sS -b "$COOKIES" -c "$COOKIES" \
    "$API/reports/$REPORT_ID/executions/$EXEC_ID/download?project_id=$PROJECT_ID" | json
fi

echo
echo "✅ E2E run finished — STATUS=$STATUS"
