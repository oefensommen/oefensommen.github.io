#!/usr/bin/env bash
# Give the TEST account game time for today, so the games can be tried without
# first doing twenty sums. Also useful to reset back to nothing.
#
#   ./scripts/testtime.sh 15     # 15 minutes of play time today
#   ./scripts/testtime.sh 0      # clear it again (back to the locked state)
#
# This script can only ever write to the "test" row. TAK is never referenced.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIN="${1:-15}"

case "$MIN" in ''|*[!0-9]*) echo "usage: testtime.sh <minutes>" >&2; exit 1;; esac

if [ "$MIN" = "0" ]; then
  SQL="update public.progress p
       set data = coalesce(p.data,'{}'::jsonb) || jsonb_build_object('days',
             coalesce(p.data->'days','{}'::jsonb) || jsonb_build_object(
               x.d, (coalesce(p.data->'days'->x.d,'{}'::jsonb) - 'reward')))
       from (select to_char(now() at time zone 'Europe/Amsterdam','YYYY-MM-DD') d) x
       where p.username = 'test';"
  echo "clearing play time on the test account…"
else
  SQL="update public.progress p
       set data = coalesce(p.data,'{}'::jsonb) || jsonb_build_object('days',
             coalesce(p.data->'days','{}'::jsonb) || jsonb_build_object(
               x.d, coalesce(p.data->'days'->x.d,'{}'::jsonb)
                    || jsonb_build_object('reward', jsonb_build_object('sec', x.s, 'used', 0))))
       from (select to_char(now() at time zone 'Europe/Amsterdam','YYYY-MM-DD') d,
                    ${MIN} * 60 s) x
       where p.username = 'test';"
  echo "giving the test account ${MIN} minutes of play time today…"
fi

"$ROOT/scripts/db.sh" -c "$SQL"
"$ROOT/scripts/db.sh" -c "select username, data->'days' as days from public.progress where username = 'test'"
