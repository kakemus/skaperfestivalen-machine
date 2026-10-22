#!/bin/bash
# Checks the machine every 5 minutes without changing anything; one line per check in rescue-report/watch.log
cd "$(dirname "$0")/.."; mkdir -p rescue-report
while true; do
  out=$(.venv/bin/python tools/rescue.py --check 2>&1 | grep -E "^[✓✗•]" | grep -v "Mac at\|Screenshot" | sed 's/ —.*//' | tr '\n' '|')
  echo "$(date '+%m-%d %H:%M')  $out" >> rescue-report/watch.log
  case "$out" in *✗*) cp rescue-report/screen.png "rescue-report/fail-$(date +%H%M).png"; cp rescue-report/log.txt "rescue-report/fail-$(date +%H%M).txt";; esac
  sleep 300
done
