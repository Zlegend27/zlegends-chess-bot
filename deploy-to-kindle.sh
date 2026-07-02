#!/bin/bash
# Builds the Kindle bundle and uploads it (plus the device-side server
# scripts) to a jailbroken Kindle over SSH.
#
# Usage: ./deploy-to-kindle.sh <KINDLE_IP>

set -e

IP="$1"
if [ -z "$IP" ]; then
  echo "Usage: ./deploy-to-kindle.sh <KINDLE_IP>"
  exit 1
fi

REMOTE_DIR="/mnt/us/kindle-chess"

echo "==> Building Kindle bundle..."
npm run build:kindle

echo "==> Creating remote directory..."
ssh "root@$IP" "mkdir -p $REMOTE_DIR"

echo "==> Uploading build output..."
scp -r dist-kindle/* "root@$IP:$REMOTE_DIR/"

echo "==> Uploading server scripts..."
scp kindle-server.py kindle-boot.sh "root@$IP:$REMOTE_DIR/"

echo "==> Setting permissions..."
ssh "root@$IP" "chmod +x $REMOTE_DIR/kindle-server.py $REMOTE_DIR/kindle-boot.sh"

echo "==> Done!"
echo ""
echo "SSH in and start the server:"
echo "    ssh root@$IP"
echo "    $REMOTE_DIR/kindle-server.py"
echo ""
echo "Then open the Kindle's Experimental Browser to http://localhost:8000"
