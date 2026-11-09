#!/usr/bin/env bash
# Downloads the first 3 GB of one month of the Lichess games database (CC0)
# to scripts/openings/data/part.pgn.zst for the Opening Trainer's data.
# Fetched as 12 byte ranges, at most 6 at a time (the server answers 429
# Too Many Requests beyond that), each resuming if it stalls, then joined in
# order. curl -f keeps error pages out of the data. collect.mjs reads the
# result; delete it afterwards.
set -u
URL="https://database.lichess.org/standard/lichess_db_standard_rated_2026-10.pgn.zst"
DIR="$(dirname "$0")/data"
TOTAL=$((3000 * 1000 * 1000))
PARTS=12
CHUNK=$((TOTAL / PARTS))
mkdir -p "$DIR"

fetch() {
  local i=$1 start=$(( $1 * CHUNK )) last=$(( ($1 + 1) * CHUNK - 1 )) out="$DIR/chunk-$1"
  touch "$out"
  for attempt in $(seq 1 60); do
    local have; have=$(stat -c %s "$out")
    [ "$((start + have))" -gt "$last" ] && break
    if ! curl -f -s -S --max-time 600 -r "$((start + have))-$last" "$URL" >> "$out" 2>>"$DIR/download.err"; then sleep 5; fi
  done
  echo "chunk $i: $(( $(stat -c %s "$out") / 1000000 )) MB"
}

for i in $(seq 0 $((PARTS - 1))); do
  fetch "$i" &
  while [ "$(jobs -rp | wc -l)" -ge 6 ]; do sleep 1; done
done
wait
: > "$DIR/part.pgn.zst"
for i in $(seq 0 $((PARTS - 1))); do cat "$DIR/chunk-$i" >> "$DIR/part.pgn.zst"; done
size=$(stat -c %s "$DIR/part.pgn.zst")
echo "done: $((size / 1000000)) MB (wanted $((TOTAL / 1000000)))"
[ "$size" -eq "$TOTAL" ] && rm -f "$DIR"/chunk-*
