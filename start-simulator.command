#!/bin/bash
# Double-click: Kvitteringsspillet in the browser, with no hardware — the same
# game as the machine runs (starts the same local server as start.command).
cd "$(dirname "$0")"
PAGE=simulator.html ./start.command
