#!/usr/bin/env bash
# Downloads the first 1.6 GB of one month of the Lichess games database
# (CC0) to scripts/vienna/data/part.pgn.zst, resuming if the connection drops.
# collect.mjs reads it from there; delete it afterwards.
set -u
URL="https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst"
OUT="$(dirname "$0")/data/part.pgn.zst"
LAST=$((1600 * 1000 * 1000 - 1))
mkdir -p "$(dirname "$OUT")"
touch "$OUT"
for attempt in $(seq 1 40); do
  have=$(stat -c %s "$OUT")
  [ "$have" -gt "$LAST" ] && break
  echo "attempt $attempt: have $((have / 1000000)) MB"
  curl -s -S --max-time 900 -r "$have-$LAST" "$URL" >> "$OUT"
done
echo "done: $(( $(stat -c %s "$OUT") / 1000000 )) MB"
