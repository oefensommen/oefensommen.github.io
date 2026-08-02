#!/usr/bin/env bash
# Give every js/css link in index.html a fresh ?v=, so a phone or tablet cannot
# keep running last week's code after a deploy. Run this before committing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
V="$(date +%Y%m%d%H%M)"

python3 - "$ROOT/index.html" "$V" <<'PY'
import re, sys
path, version = sys.argv[1], sys.argv[2]
html = open(path).read()
# only local assets; the favicon is a data: URI and is left alone
new, n = re.subn(
    r'((?:src|href)="(?:js|css)/[^"?]+)(?:\?v=[0-9]+)?"',
    lambda m: f'{m.group(1)}?v={version}"',
    html)
open(path, "w").write(new)
print(f"stamped {n} assets with v={version}")
PY
