#!/bin/bash
# Double-click: runs the phone version of the machine (the life game, the
# phone's panel) on this Mac instead of the phone — for when the phone isn't
# there. Same page, in Chrome on the Mac; plug the printer and the micro:bit
# into the Mac.
cd "$(dirname "$0")"
PAGE=phone.html exec ./start.command
