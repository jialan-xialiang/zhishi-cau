#!/usr/bin/env bash
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
if command -v python3 >/dev/null 2>&1; then
  exec python3 server.py
else
  exec python server.py
fi
