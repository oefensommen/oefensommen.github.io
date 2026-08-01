#!/usr/bin/env bash
# Run SQL against the Supabase project without opening the dashboard.
#
#   ./scripts/db.sh supabase-live.sql        # run a file
#   ./scripts/db.sh -c "select 1"            # run one statement
#
# Needs a Supabase personal access token in .env.local (gitignored):
#   SUPABASE_ACCESS_TOKEN=sbp_...
# Get one at https://supabase.com/dashboard/account/tokens

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_REF="ffvqqjyfmwkqljwhrhtl"

[ -f "$ROOT/.env.local" ] && set -a && . "$ROOT/.env.local" && set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "No SUPABASE_ACCESS_TOKEN." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens and put it in .env.local:" >&2
  echo "  SUPABASE_ACCESS_TOKEN=sbp_..." >&2
  exit 1
fi

if [ "${1:-}" = "-c" ]; then
  SQL="${2:?missing sql}"
  LABEL="inline statement"
else
  FILE="${1:?usage: db.sh <file.sql> | -c \"<sql>\"}"
  [ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }
  SQL="$(cat "$FILE")"
  LABEL="$FILE"
fi

# JSON-encode the SQL safely (quotes, newlines, tabs)
BODY="$(SQL="$SQL" python3 -c 'import json,os;print(json.dumps({"query":os.environ["SQL"]}))')"

OUT="$(mktemp)"
CODE="$(curl -s -o "$OUT" -w '%{http_code}' \
  -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$BODY")"

if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  echo "✅ ran $LABEL"
  # print rows only when the statement returned some
  python3 - "$OUT" <<'PY'
import json,sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
if isinstance(d, list) and d:
    print(json.dumps(d, indent=1, ensure_ascii=False)[:4000])
PY
else
  echo "❌ HTTP $CODE while running $LABEL" >&2
  cat "$OUT" >&2; echo >&2
  rm -f "$OUT"; exit 1
fi
rm -f "$OUT"
