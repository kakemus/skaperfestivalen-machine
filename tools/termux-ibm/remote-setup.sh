# One-time setup so the Mac can look after the phone over the hotspot (2026-10-22).
# Run in Termux:  curl -s localhost:8999/s | bash   (while tools/rescue.py --setup runs on the Mac)
# - sshd (port 8022, only the Mac's key) so the Mac can start/fix the display helper directly;
# - ~/.machine-autostart.sh, run from ~/.bashrc: whenever Termux opens, sshd and the display
#   helper start by themselves (Xiaomi blocks typing from the Mac, but opening Termux works).
set -e
echo "== installing openssh (a minute) =="
pkg install -y openssh python libusb termux-api >/dev/null 2>&1 || pkg install -y openssh
mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
grep -qF "__KEY__" ~/.ssh/authorized_keys || echo "__KEY__" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
curl -s localhost:8999/ibm_bridge.py -o ~/ibm_bridge.py
curl -s localhost:8999/start-display.sh -o ~/start-display.sh
chmod +x ~/start-display.sh
cat > ~/.machine-autostart.sh <<'EOF'
pgrep -x sshd >/dev/null || sshd
pgrep -f ibm_bridge.py >/dev/null || (nohup bash ~/start-display.sh > ~/display.log 2>&1 &)
EOF
grep -q machine-autostart ~/.bashrc 2>/dev/null || echo '[ -f ~/.machine-autostart.sh ] && bash ~/.machine-autostart.sh' >> ~/.bashrc
bash ~/.machine-autostart.sh
echo "== DONE - the Mac can reach this phone now (user $(whoami)) =="
