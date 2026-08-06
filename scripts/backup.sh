#!/usr/bin/env bash
# Pull every account's progress out of Supabase into backups/ on this machine.
#
#   ./scripts/backup.sh
#
# The database already snapshots itself every night (see supabase-backup.sql).
# That protects the DATA — a bad write can be undone from the snapshot table.
# This script protects against losing the PROJECT: the file it writes does not
# depend on Supabase being there tomorrow.
#
# backups/ is gitignored, so a child's history never reaches the public repo.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/backups"
STAMP="$(date +%Y-%m-%d)"
mkdir -p "$OUT"

# The row can be larger than the query API will return in one piece, so it comes
# back in slices of 2000 characters, base64'd so nothing is mangled on the way.
fetch_slice() {                     # $1 = username, $2 = offset
  "$ROOT/scripts/db.sh" -c \
    "select encode(convert_to(substring(data::text from $2 for 2000),'UTF8'),'base64') as p
       from public.progress where username='$1'" 2>/dev/null \
  | python3 -c "import sys,json;s=sys.stdin.read();print(json.loads(s[s.index('['):])[0]['p'].replace(chr(10),''))"
}

users="$("$ROOT/scripts/db.sh" -c "select username from public.progress order by username" 2>/dev/null \
  | python3 -c "import sys,json;s=sys.stdin.read();print(' '.join(r['username'] for r in json.loads(s[s.index('['):])))")"

echo "accounts: $users"
for u in $users; do
  len="$("$ROOT/scripts/db.sh" -c "select length(data::text) as n from public.progress where username='$u'" 2>/dev/null \
    | python3 -c "import sys,json;s=sys.stdin.read();print(json.loads(s[s.index('['):])[0]['n'])")"
  parts="$OUT/.$u.parts"; : > "$parts"
  off=1
  while [ "$off" -le "$len" ]; do
    fetch_slice "$u" "$off" >> "$parts"
    off=$((off + 2000))
  done
  python3 - "$parts" "$OUT/$u-$STAMP.json" <<'PY'
import base64, json, sys
parts, dest = sys.argv[1], sys.argv[2]
txt = "".join(base64.b64decode(l.strip()).decode("utf-8") for l in open(parts) if l.strip())
json.loads(txt)                       # refuse to write a file that is not valid JSON
open(dest, "w").write(txt)
print(f"  {dest.split('/')[-1]}  ({len(txt)} bytes)")
PY
  rm -f "$parts"
done

echo "kept in $OUT:"
ls -1t "$OUT" | head -8
