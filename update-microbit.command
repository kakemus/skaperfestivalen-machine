#!/bin/bash
# Double-click: puts the newest machine firmware on the micro:bit over USB.
# (Not by dragging a .hex any more — the program got too big for the micro:bit
# to load in one go; firmware/upload.py sends it in pieces. Your belt settings
# on the board stay as they are.)
# Close the belt page / game page first: only one program can use the micro:bit.
cd "$(dirname "$0")"
# A private Python just for this, inside the project (.venv, made once): the
# Mac's Homebrew Python refuses to install packages for itself (PEP 668).
PY=.venv/bin/python
if ! $PY -c "import serial" 2>/dev/null; then
  echo "Setting up the serial-port helper (once)…"
  python3 -m venv .venv && $PY -m pip install --quiet pyserial || { echo "Couldn't set it up."; read -n 1 -s -r -p "Press any key to close."; exit 1; }
fi
if $PY firmware/upload.py "$@"; then
  echo
  echo "Done. The micro:bit restarts and shows M."
else
  echo
  echo "That didn't work. Is the micro:bit plugged in, and the belt/game page closed?"
  echo "If the micro:bit was flashed with a .hex since, run:  python3 firmware/upload.py --loader"
fi
read -n 1 -s -r -p "Press any key to close."
