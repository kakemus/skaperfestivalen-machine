set -e
echo "== installing python, libusb, termux-api (a few minutes) =="
yes | pkg upgrade -y -o Dpkg::Options::=--force-confnew || true
pkg install -y python libusb termux-api
curl -s localhost:8999/ibm_bridge.py -o ~/ibm_bridge.py
curl -s localhost:8999/start-display.sh -o ~/start-display.sh
chmod +x ~/start-display.sh
python -c "import ctypes,os; ctypes.CDLL(os.environ['PREFIX']+'/lib/libusb-1.0.so'); print('libusb ok')"
echo "== SETUP DONE =="
