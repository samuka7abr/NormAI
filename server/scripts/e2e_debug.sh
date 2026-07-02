#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:8000"
FILE="${E2E_FILE:-data/base_maus_tratos_subset.xlsx}"
COOKIE="/tmp/normai-curl-cookies-$$.txt"
EMAIL="curl-ai-$(date +%s)@test.dev"
PASSWORD="senha123_curl"

json_field() { python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
pretty() { python3 -m json.tool 2>/dev/null || cat; }

echo "### register"
curl -sS -f -c "$COOKIE" -H "Content-Type: application/json" \
  -X POST "$API/auth/register" \
  -d "{\"name\":\"Curl\",\"last_name\":\"AI\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
echo "ok"

echo "### create project (retry no 409 espurio do race register->create)"
PNAME="Curl teste IA especies $(date +%s)"
PBODY="{\"name\":\"$PNAME\",\"description\":\"Teste E2E debug\",\"ai_context\":\"Na coluna espécies afetadas, a classificação deve ser por tipo de animal.\\nse for pitbull ou pastor alemão, deve ser classificado como cachorro, por exemplo.\\nse for tilápia ou pirarucu, deve ser classificado como peixe.\\ndaí por diante.\"}"
PROJECT_ID=""
for attempt in 1 2 3 4 5 6; do
  PCODE=$(curl -sS -o /tmp/pcreate-$$.json -w "%{http_code}" -b "$COOKIE" -c "$COOKIE" -H "Content-Type: application/json" \
    -X POST "$API/projects" -d "$PBODY")
  if [ "$PCODE" = "201" ]; then
    PROJECT_ID=$(json_field id < /tmp/pcreate-$$.json)
    break
  fi
  echo "tentativa $attempt: HTTP=$PCODE ($(cat /tmp/pcreate-$$.json)) — retry"
  sleep 1
done
rm -f /tmp/pcreate-$$.json
[ -z "$PROJECT_ID" ] && { echo "FALHOU criar projeto"; exit 1; }
echo "project_id=$PROJECT_ID"

echo "### configure columns"
curl -sS -f -b "$COOKIE" -c "$COOKIE" -H "Content-Type: application/json" \
  -X PUT "$API/projects/$PROJECT_ID/columns" \
  -d '[
    {"column_name":"tribunal","enabled":true,"normalizations":{"trim":true,"nulls":true,"abbreviate":true},"classify":false},
    {"column_name":"comarca","enabled":true,"normalizations":{"capitalize_pt_br":true,"nulls":true,"remove_accents":true},"classify":false},
    {"column_name":"especies_afetadas","enabled":true,"normalizations":{"trim":true,"nulls":true},"classify":true}
  ]' >/dev/null
echo "ok"

echo "### upload $FILE"
UPLOAD_JSON=$(curl -sS -f -b "$COOKIE" -c "$COOKIE" \
  -X POST "$API/projects/$PROJECT_ID/reports" \
  -F "file=@$FILE;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
REPORT_ID=$(echo "$UPLOAD_JSON" | json_field report_id)
EXEC_ID=$(echo "$UPLOAD_JSON" | json_field execution_id)
echo "report_id=$REPORT_ID exec_id=$EXEC_ID"

STATUS_URL="$API/reports/$REPORT_ID/executions/$EXEC_ID/status?project_id=$PROJECT_ID"
SAW_PROCESSING=0
START=$(date +%s)
for i in $(seq 1 180); do
  STATUS_JSON=$(curl -sS -f -b "$COOKIE" -c "$COOKIE" "$STATUS_URL")
  STATUS=$(echo "$STATUS_JSON" | json_field status)
  NOW=$(date +%s); ELAPSED=$((NOW-START))
  if [ "$STATUS" = "PROCESSING" ] && [ "$SAW_PROCESSING" = "0" ]; then
    SAW_PROCESSING=1
    echo ">>> PROCESSING visto em ${ELAPSED}s (poll #$i)"
  fi
  printf "[%03d] t=%ss status=%s\n" "$i" "$ELAPSED" "$STATUS"
  if [ "$STATUS" = "READY" ] || [ "$STATUS" = "ERROR" ]; then
    break
  fi
  sleep 5
done

echo "### final status"
echo "$STATUS_JSON" | pretty

if [ "$STATUS" = "READY" ]; then
  echo "### download url"
  DL_JSON=$(curl -sS -f -b "$COOKIE" -c "$COOKIE" \
    "$API/reports/$REPORT_ID/executions/$EXEC_ID/download?project_id=$PROJECT_ID")
  echo "$DL_JSON" | pretty
  DL_URL=$(echo "$DL_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url') or d.get('download_url') or d.get('presigned_url') or '')")
  if [ -n "$DL_URL" ]; then
    OUT="data/result_e2e_${EXEC_ID}.xlsx"
    curl -sS --fail --location --resolve localstack:4566:127.0.0.1 "$DL_URL" --output "$OUT"
    echo ">>> baixado: $OUT"
    echo "RESULT_FILE=$OUT"
  fi
fi
echo "E2E_DONE status=$STATUS"
rm -f "$COOKIE"
