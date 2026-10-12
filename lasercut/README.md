# Scroll cassette — laser-cut box

The box that holds the paper strip, both spools, the light sensor and the backlight.
It later slides into the arcade cabinet as one unit.

## Files

| File | Material | What |
|---|---|---|
| `cassette_mdf_3mm.svg` | 3 mm MDF, one 570 × 400 bed | front, front doubler, left wall (motors), right wall (axles), top, bottom, back plate, 2 joint-test pieces |
| `cassette_diffuser_3mm.svg` | 3 mm opal / frosted acrylic | the diffuser |
| `make_cassette.py` | — | makes both files; change a number at the top and run `python3 lasercut/make_cassette.py` |

Red lines = cut. Blue = engrave or score (part names, where the motors and the LED matrix go).
Units are millimetres — check the laser software imports at 1:1 (the blue sheet outline is 570 × 400).

**Cut the two TEST pieces first** and push them together. They should slot in firmly by hand.
Too loose or too tight → set `KERF` in `make_cassette.py` (try 0.1), regenerate, test again.

## Cutting the big MDF boards down to laser size

The boards are 1190 × 815 mm, the laser bed 570 × 400. Each board gives **4 pieces**:

```
 1190 ──────────────────────────────────
 ┌────────────────┬────────────────┬──┐
 │   565 × 395    │   565 × 395    │  │ 815
 ├────────────────┼────────────────┤  │
 │   565 × 395    │   565 × 395    │  │
 └────────────────┴────────────────┴──┘
   (≈ 55 mm strip on the right, ≈ 20 mm along the bottom: offcuts)
```

1. Cut across the 1190 side at **565 mm** (a first cut), then again at 565 from that cut.
2. Cut each 565 × 815 strip across at **395 mm**.

565 × 395 rather than the full 570 × 400 leaves a few millimetres so a slightly crooked saw cut
still fits the bed. 2 mm MDF can be scored with a sharp knife against a steel ruler (several
passes) and snapped; 3 mm too with patience, but a table/track saw at the workshop is quicker.

**What goes on which:** the box is 3 mm (one bed piece). The 2 mm pieces are for later parts —
spacers, the coin chute, button plates, test pieces — or a lighter front doubler.

## Box size

Outer 126 × 216 × 95 mm. Window 64 × 90 mm (one screen of the strip shows through it).

## Also needed

- 2 × 6 mm wooden dowel, 126 mm long (paper guides, through both side walls)
- 2 × M3 screw ~16 mm + nuts/washers (spool axles in the right wall; washers fill the gap so the spool can't slide)
- 4–8 cable ties, max 2.5 mm wide (hold the motors to the left wall)
- the 5 mm LDR (goes in the small hole beside the window, sensor face flush with the inside)
- the 8 × 8 NeoPixel matrix (hot glue or double-sided tape inside the engraved square on the back plate)
- wood glue

## Assembly

1. Glue the **front doubler** onto the front panel's outside, holes lined up.
2. Glue **left wall, right wall, top and bottom** to the front with their finger joints.
   The front edge of each is marked. The back stays open.
3. Slide the **diffuser** into the slots halfway back before the second side wall is glued.
4. **Motors**, inside, along the left wall: rear shaft through the 8 mm hole, can pointing to the
   back, inside the engraved outline. Strap with cable ties through the small slots.
   Motor wires out through the round hole behind the motor.
5. **Spools**: push onto the motor shafts; M3 screw through the right wall into the spool's axle hole,
   washers between spool and wall.
6. **Dowels** through both walls, above and below the window. The paper runs in front of them
   (between dowels and front panel), so the screen in the window is flat.
7. **LDR** into the hole beside the window, from the front; legs come out behind the scanner housing.
8. **Back plate**: LED matrix on its inside (engraved square), wires through the slot; slide its
   tabs into the notches at the back of the side walls.
9. Mount the **scanner housing** on the front with bolts through the slots above/below the window.
10. Optional: paint the inside matte black so only the paper glows.

## Unchecked

- TT motor sizes are typical values (70 × 22.5 × 18.8 mm, shaft ~11 mm from the gearbox end).
  Hold a motor against the engraved outline before gluing.
- The scanner housing's own bracket positions weren't measured exactly — the slots are long so
  it can be bolted anywhere along them.
