#!/bin/bash
# Double-click: offers the phone version of the machine (and the phone check
# page) to a phone on the same Wi-Fi — in practice the iPhone hotspot.
cd "$(dirname "$0")"
PORT=8131
for PID in $(lsof -ti tcp:$PORT 2>/dev/null); do kill "$PID" 2>/dev/null; done
sleep 0.3
python3 phone_server.py $PORT &
SERVER=$!
sleep 0.8
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
clear
echo "THE MACHINE — PHONE VERSION"
echo
if [ -z "$IP" ]; then
  echo "This Mac isn't on Wi-Fi. Join the same Wi-Fi as the phone (or the phone's hotspot) and run this again."
else
  echo "1. Phone and Mac on the same Wi-Fi (the phone's own hotspot works too)."
  echo "2. In Chrome on the phone, open:   chrome://flags/#unsafely-treat-insecure-origin-as-secure"
  echo "   set it to Enabled, type in:     http://$IP:$PORT"
  echo "   and press Relaunch. (Chrome only allows USB on secure pages; this marks this one as OK.)"
  echo "3. Then open:                      http://$IP:$PORT"
  echo "   (the phone keeps a copy: later it opens without this Mac. Phone check: http://$IP:$PORT/phonecheck.html)"
  echo
  echo "If the Mac asks whether Python may accept incoming connections: Allow."
fi
echo
echo "Leave this window open while testing. Close it to stop."
wait $SERVER
