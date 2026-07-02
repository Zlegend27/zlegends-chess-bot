#!/bin/sh
# Launches the Kindle chess server in the background.
# Intended for cron `@reboot /mnt/us/kindle-chess/kindle-boot.sh`.

cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

nohup "$PY" ./kindle-server.py > ./server.log 2>&1 &
