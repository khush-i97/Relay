#!/bin/sh
set -e
cd /workspace
if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi
nohup npm run dev > /tmp/relay-dev.log 2>&1 &
i=0
while [ "$i" -lt 60 ]; do
  if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.5
done
echo "dev server did not become ready" >&2
exit 1
