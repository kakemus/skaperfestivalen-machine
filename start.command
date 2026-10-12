#!/bin/bash
# Double-click to start the machine: runs the small local web server and opens
# the page in Chrome. (Chrome only keeps printer/micro:bit/display permissions
# for a real http://localhost page, not a file opened directly — and WebUSB,
# WebHID and Web Serial only exist in Chrome.)
cd "$(dirname "$0")"
PORT=8130

# Always start a fresh server so an old one can't serve stale files.
for PID in $(lsof -ti tcp:$PORT 2>/dev/null); do
  COMMAND=$(ps -p "$PID" -o command= 2>/dev/null)
  case "$COMMAND" in
    *devserver.py*" $PORT"*) kill "$PID" 2>/dev/null ;;
    *) echo "Port $PORT is already used by another application: $COMMAND"; exit 1 ;;
  esac
done
sleep 0.3

# nohup + disown: keep the server alive after this Terminal window closes.
nohup python3 devserver.py "$PORT" > /tmp/machine-server.log 2>&1 &
disown

STARTED=no
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s "http://localhost:$PORT" > /dev/null 2>&1 && STARTED=yes && break
  sleep 0.5
done

if [ "$STARTED" = no ]; then
  echo "The machine's server didn't start. What it said:"
  echo
  cat /tmp/machine-server.log
  echo
  if grep -q "Operation not permitted" /tmp/machine-server.log; then
    echo "macOS is blocking Terminal from this folder. Fix: System Settings ->"
    echo "Privacy & Security -> Files & Folders -> Terminal -> turn on the folder"
    echo "this project is in (Documents/Desktop), then double-click start.command again."
  fi
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

open -a "Google Chrome" "http://localhost:$PORT/${PAGE:-}" 2>/dev/null || open "http://localhost:$PORT/${PAGE:-}"
