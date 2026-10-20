#!/data/data/com.termux/files/usr/bin/bash
# Finds the IBM display (USB 04b3:4526), asks Android for permission, and runs the bridge.
termux-wake-lock
dev=""
for d in /sys/bus/usb/devices/*; do
  if [ "$(cat $d/idVendor 2>/dev/null)" = "04b3" ] && [ "$(cat $d/idProduct 2>/dev/null)" = "4526" ]; then
    dev=$(printf "/dev/bus/usb/%03d/%03d" "$(cat $d/busnum)" "$(cat $d/devnum)")
  fi
done
if [ -z "$dev" ]; then
  echo "Couldn't read the USB list directly - these are the USB devices:"
  termux-usb -l
  echo "Run:  bash ~/start-display.sh /dev/bus/usb/xxx/yyy   (the display's path)"
  [ -n "$1" ] && dev="$1" || exit 1
fi
echo "IBM display at $dev - tap ALLOW if Android asks"
termux-usb -r "$dev"
exec termux-usb -e "python $HOME/ibm_bridge.py" "$dev"
