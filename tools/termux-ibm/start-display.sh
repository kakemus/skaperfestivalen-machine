#!/data/data/com.termux/files/usr/bin/bash
# Finds the IBM display (USB 04b3:4526) among the USB devices, and runs the bridge on it.
# Termux can't read the USB list itself, so each device is asked once (Android may show an
# Allow dialog for each the first time) and probed — the last path that worked is tried first.
termux-wake-lock
pkill -f ibm_bridge.py 2>/dev/null; sleep 0.5
last=$(cat ~/.ibm_display_path 2>/dev/null)
all=$(termux-usb -l | grep -o '/dev/bus/usb/[0-9/]*')
for dev in ${1:-$last} $all; do
  [ -n "$dev" ] || continue
  termux-usb -r "$dev" >/dev/null 2>&1 || continue
  if termux-usb -e "python $HOME/ibm_bridge.py --probe" "$dev" 2>/dev/null | grep -q '^IBM'; then
    echo "IBM display at $dev"
    echo "$dev" > ~/.ibm_display_path
    exec termux-usb -e "python $HOME/ibm_bridge.py" "$dev"
  fi
done
echo "IBM display not found - is it plugged into the hub?"
