# Belt reliability: save point (2026-10-15)

Where we stopped: the belt works most of the time but isn't reliable enough yet. This
is the plan agreed with the maker, to pick up after the buttons are wired.

## Symptoms (seen on the real machine)

1. **The light sensor isn't reliable**, even when calibrated exactly.
2. **Step down doesn't work**: it stays on the same screen, moving up and down rapidly.
3. **Step up works almost always**, except for the **last screen, which it skips**.
4. **Find START sometimes goes back only one screen.**

The maker's main suspect: **the paper isn't always the same distance from the sensor**.
The mechanism lets it vary a little from move to move.

## Likely causes

- **One fixed threshold** decides mark vs. paper. When the paper's distance changes, both
  the paper and the mark readings shift, so the threshold ends up wrong. Room light also
  reaches the sensor (open at the front).
- **Step down (no. 2)**: down moves start right at the edge of the current mark. The LDR
  is slow, so it still "sees" the mark for a moment after leaving it. The board takes
  that as the next mark, stops after a few mm and settles back onto the same mark. The
  firmware's "ignore marks at the start" delay (`mingap`) was removed for down moves
  (to fix START slipping by when starting just below it from an *unknown* position).
- **Last screen skipped (no. 3)**: the last mark is missed, probably because the paper
  runs differently at that end of the roll. (Black bands near the sensor column were
  considered; the maker doesn't think they're the cause, so leave them.)
- **Find START short (no. 4)**: the board's position count was off (a missed or extra
  mark earlier), or an ordinary mark was taken for START.

## Plan, in order

### A. Measure first (code)
A **light trace** on the belt page: the sensor reading drawn as a graph while the belt
moves (the board streams readings fast during moves). Shows the real gap between
paper and mark, the wobble, and how slow the LDR is. Take a trace before and after
each fix below.

### B. Mechanics, the biggest win (the maker)
- Hold the paper at a **fixed distance right at the sensor**: put the sensor where the
  paper runs over a dowel (always pulled tight against it), or add a soft foam/felt pad
  pressing the paper flat at that spot.
- **Shade the sensor** from room light: a short black sleeve (black tape) from the sensor
  to the paper.
- Make sure a **backlight LED sits right behind the sensor's spot** (the sensor reads light
  coming *through* the paper).

### C. Strip, next print
- **Taller marks** (12–15 mm instead of 8). **Not wider** (the maker's call).
- Meanwhile, darkening the current marks with a black marker helps.

### D. Code: tolerate a changing signal (firmware/machine.py)
- **Moving threshold**: during a move, track how bright the paper is *right now* (recent
  maximum) and call it a mark when it gets clearly darker than that, rather than below a
  fixed number. Distance drift then stops mattering.
- **A mark must be real**: dark for a minimum time (not a flicker), and not in the first
  part of a move. Bring the start delay back for down moves when the position is known
  (fixes no. 2).
- **Timing sanity check**: a screen takes about the same time every move (learned
  `upms` / `screenms`). A "mark" much too early is ignored; far too late stops the move
  (the blank-paper limit already does the latter).
- **Position check at START**: when the long START mark shows up unexpectedly, correct the
  position count (helps no. 4).

## Related notes
- If the firmware gets too big again (it's sent in pieces over USB, see `firmware/upload.py`),
  the first thing to drop is the backlight colour picker (`cr/cg/cb` + gamma). A fixed
  slightly warm white is fine; keep the red/green flashes.
