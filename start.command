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

for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 0.5
done

open -a "Google Chrome" "http://localhost:$PORT/" 2>/dev/null || open "http://localhost:$PORT/"
