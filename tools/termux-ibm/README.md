# The IBM till display on the Android phone (2026-10-20)

Android's Chrome has no WebHID, and Chrome won't let WebUSB talk to HID devices, so
the game page can't reach the IBM display (USB 04b3:4526) itself. This helper runs
in **Termux** on the phone instead: it gets the display from Android (`termux-usb`),
drives it with libusb, and listens on `http://127.0.0.1:8765` for the page
(`/show?top=…&bottom=…`, `/clear`, `/ping`). phone.js sends the game's two lines
there (`game/kvitteringDisplay.js`). The display's font has no Æ Ø Å — the helper
draws them as custom characters 1–3. It only ever writes to the interface whose
report descriptor says usage 0x2600 and not 0xA000 (the firmware-upgrade one).

**Installed on the Redmi:** F-Droid's Termux 0.118.3 + Termux:API 0.53.0, then
`setup.sh` (python, libusb, termux-api). The files were fetched from the Mac through
`adb reverse tcp:8999` and `python3 -m http.server 8999` in a folder with these files.

**Start it (after every phone restart, or when the display was unplugged):** open
Termux and run `bash ~/start-display.sh` (the phone panel has a Copy button), tap
Allow. The display shows KVITTERINGSSPILLET / KLAR. Termux can't read the USB list
itself, so the script tries each device from `termux-usb -l` with `ibm_bridge.py
--probe` (reads only the device descriptor) until one is 04b3:4526, the last path
that worked first; Android may ask Allow once per device. Updates: phone_server.py
serves these two files, and the panel's second Copy button fetches them.
