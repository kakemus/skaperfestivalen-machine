# The Receipt Game (Kvitteringsspillet)

An arcade machine that plays out a whole life in ten choices and prints it on a receipt.
Each question appears on a backlit paper scroll, you answer with two big buttons, and a
thermal printer prints what happened: the friends you made, the money you spent, and the
story of each choice. Run out of money or friends and the game is over; survive all ten and
the bell rings.

Built for Skaperfestivalen 2026 (Deichman, Oslo) in the course *Awe & Wonder* at the Oslo
School of Architecture and Design (AHO). Script by Aksel Gøytil Bødtker. The game texts are
Norwegian. Full build guide on Instructables: *The Receipt Game: An Arcade Machine That
Prints Your Whole Life on a Receipt*.

## How it works

- **An old Android phone is the brain.** It runs the game as a web page in Chrome and talks
  to the receipt printer and the micro:bit directly over USB (WebUSB). After the first visit
  the page keeps a copy of itself, so the machine runs with no computer and no internet.
- **A micro:bit V2 on a Wukong board runs the scroll.** Two TT motors wind a paper strip
  between two spools; a light sensor watches for a black mark on each screen, so the
  micro:bit always knows where the scroll is. The first screen has a long mark: that's START.
- **An Epson TM-T20II prints both the receipt and the scroll itself.** Everything is drawn on
  a canvas in the browser and sent as ESC/POS raster images.
- **A second-hand IBM till display** (2 × 20 characters) shows what to do next. Chrome on
  Android can't reach it, so a small Python helper in Termux drives it.

## What's where

| Folder | |
|---|---|
| `game/` | The game. `manus.js` holds every question, answer, friend and price, as plain data: write your own game there. `kvittering*.js` is the Receipt Game, `tankeleser*.js` a second game for the same machine (the Mind Reader). |
| `phone.html`, `phone.js` | The page the phone runs, with an operator panel (⚙): connect devices, print the scroll, step the belt, calibrate. |
| `phone_server.py` | Serves the phone page on your network: `python3 phone_server.py`, then open `http://<this computer's IP>:8131` in Chrome on the phone. |
| `firmware/machine.py` | The micro:bit program (MicroPython). Flash it with the micro:bit Python editor. |
| `lasercut/` | The cabinet and the scroll cassette as SVGs, and the Python scripts that generate them. See `lasercut/README.md`. |
| `docs/cabinet-assembly.html` | Step-by-step assembly of the cabinet. |
| `3d/` | The spools (`spool.stl`) and their OpenSCAD source. |
| `tools/termux-ibm/` | The IBM display helper for Termux. |
| `tools/rescue.py` | Check and fix the machine from a Mac over Wi-Fi (adb + Chrome remote debugging). |
| `tests/` | `node --test tests/kvittering.test.mjs` plays every path through the script. |

The pictures on the scroll (`bilder/*.png`) aren't in the repo; without them the scroll
shows each picture's description in a box instead.

## Made with AI

I'm a designer, not a programmer. Most of the code was written with Claude (Anthropic) as a
coding assistant; the idea, the design, the build, the testing with real people and every
decision are mine. The Instructables post has the details.
