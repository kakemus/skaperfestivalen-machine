pkill -f ibm_bridge.py; sleep 1
curl -s localhost:8999/ibm_bridge.py -o ~/ibm_bridge.py
curl -s localhost:8999/start-display.sh -o ~/start-display.sh
bash ~/start-display.sh ${1:-/dev/bus/usb/001/009}
