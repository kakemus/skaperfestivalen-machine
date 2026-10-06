"""Laser-cut files for the scroll cassette — the box that holds the paper strip,
both spools, the light sensor and the backlight, and later slides into the
arcade cabinet.

  python3 lasercut/make_cassette.py
  → lasercut/cassette_plywood_4mm.svg   (one 600 × 400 mm sheet of 4 mm plywood)
  → lasercut/cassette_diffuser_3mm.svg  (the diffuser, 3 mm opal / frosted acrylic)

Red = cut, blue = engrave/score (part names, placement marks). Units are mm.

THE BOX — finger-jointed, open back, outer 128 × 218 × 96 mm:
  front (+ a glued doubler in front of it for the heavy scanner housing),
  left wall (motors), right wall (axles), top, bottom, a removable back plate
  that slides into notches at the back of the side walls (the 8×8 NeoPixel
  matrix goes on it), and the diffuser in slots halfway back.
INSIDE, seen from the side: the paper runs 2 mm behind the front panel, kept
flat by two 6 mm dowels just above and below the window; the spools sit
above and below; the light sensor looks through a hole in the front panel
beside the window, where the strip's black marks pass. The window is
narrower than the paper on purpose, so marks and sensor stay hidden.
MOTORS lie inside along the left wall, can pointing backwards; the TT
motor's rear shaft goes through an 8 mm hole (that hole is what locates
it), and cable ties through the small slots hold it. If your motor has only
one shaft, the hole does no harm — rely on the ties.

Everything is computed from the numbers below; change one and re-run.
TT motor sizes are typical ones (70 × 22.5 × 18.8 mm, shaft ≈ 11 mm from the
gearbox end) — check against yours before cutting.
"""
import math
import os

# ---------- numbers ----------
T = 4.0             # plywood thickness
T_DIFF = 3.0        # diffuser acrylic thickness
KERF = 0.0          # laser kerf compensation; cut the joint test first and adjust

INNER_W = 120.0     # between the side walls: motor gearbox 18.8 + spool 97.8 + play
INNER_H = 210.0     # between top and bottom
INNER_D = 92.0      # front panel back face → back edge

GEARBOX_T = 18.8    # TT gearbox thickness along the shaft
SPOOL_L = 97.8      # spool length (3d/spool.stl)
SPOOL_R = 20.0      # flange radius
CORE_R = 11.0       # spool core radius
PAPER_W = 80.0
FLANGE_T = 2.4

PAPER_Z = 3.0       # paper distance behind the front panel (dowel holes then keep ~3 mm from the finger joints)
DOWEL_D = 6.0       # guide dowels (6 mm wooden dowel)
SPOOL_CLEAR = 3.0   # flange ↔ front panel clearance
TOP_SPOOL_Y = 30.0  # spool axes, measured from the inner top
BOT_SPOOL_Y = 180.0
WINDOW_TOP = 60.0   # visible window, from the inner top
WINDOW_H = 90.0
WINDOW_X0 = 13.0    # window from 13 mm to 77 mm across the paper: hides the marks (0–10 mm)
WINDOW_X1 = 77.0
MARK_X = 5.0        # middle of the strip's black marks, from the paper's left edge
LDR_D = 5.2         # hole for a 5 mm LDR

MOTOR_SHAFT_HOLE = 8.0
MOTOR_REAR = 59.0   # motor can length behind the shaft
AXLE_D = 3.3        # M3 axle
DIFF_Z = 55.0       # diffuser position behind the front panel
DIFF_H = 100.0      # diffuser height (covers the window region)
LED_PANEL = 65.0    # 8×8 NeoPixel matrix size
NOTCH_Y = (60.0, 130.0)   # back-plate notches (inner y of their top edge, 20 mm long): symmetric

X = INNER_W + 2 * T          # outer width
Y = INNER_H + 2 * T          # outer height
Z = INNER_D + T              # outer depth (front panel included)

# derived positions (inner coordinates: x from the left wall, y from the top, z from the front panel's back face)
paper_x0 = GEARBOX_T + 0.5 + FLANGE_T + (84 - PAPER_W) / 2
spool_z = SPOOL_CLEAR + SPOOL_R
dowel_z = PAPER_Z + DOWEL_D / 2
window_x = (paper_x0 + WINDOW_X0, paper_x0 + WINDOW_X1)
ldr_x = paper_x0 + MARK_X
win_mid_y = WINDOW_TOP + WINDOW_H / 2
assert GEARBOX_T + 0.5 + SPOOL_L < INNER_W, "spool + motor don't fit between the walls"
assert spool_z + MOTOR_REAR < INNER_D - T, "motor can hits the back plate"
assert TOP_SPOOL_Y - SPOOL_R > 0 and BOT_SPOOL_Y + SPOOL_R < INNER_H, "spool flange hits top/bottom"


# ---------- finger-jointed outlines ----------
def segments(length):
    n = max(3, round(length / 16))
    return n + 1 if n % 2 == 0 else n


def depths(kind, length):
    """kind 'F': fingers out at both ends, 'H': the complement, 'P': plain edge."""
    if kind == "P":
        return [0.0]
    n = segments(length)
    out_even = kind == "F"
    return [0.0 if (i % 2 == 0) == out_even else T for i in range(n)]


def outline(w, h, kinds):
    """kinds = (bottom, right, top, left) edge kinds of a w × h face (y down in the SVG,
    so 'bottom' is the v = 0 edge). Returns the polygon points."""
    lengths = (w, h, w, h)
    ds = [depths(k, L) for k, L in zip(kinds, lengths)]

    def at(edge, s, d):
        return [(s, d), (w - d, s), (w - s, h - d), (d, h - s)][edge]

    pts = []
    for e in range(4):
        L = lengths[e]
        dd = ds[e]
        n = len(dd)
        seg = L / n
        s0 = ds[(e - 1) % 4][-1]          # start where the previous edge's last depth ends
        s1 = L - ds[(e + 1) % 4][0]       # stop where the next edge's first depth begins
        pts.append(at(e, s0, dd[0]))
        for i in range(1, n):
            s = i * seg
            pts.append(at(e, s, dd[i - 1]))
            pts.append(at(e, s, dd[i]))
        pts.append(at(e, s1, dd[-1]))
    clean = []
    for p in pts:
        if not clean or abs(p[0] - clean[-1][0]) > 1e-6 or abs(p[1] - clean[-1][1]) > 1e-6:
            clean.append(p)
    return clean


# ---------- SVG helpers ----------
CUT = 'fill="none" stroke="#ff0000" stroke-width="0.1"'
MARK = 'fill="none" stroke="#0000ff" stroke-width="0.1"'
LABEL = 'fill="#0000ff" font-family="Helvetica, Arial, sans-serif"'


def poly(pts):
    return f'<polygon points="{" ".join(f"{x:.3f},{y:.3f}" for x, y in pts)}" {CUT}/>'


def rect(x, y, w, h, style=CUT, r=0):
    return f'<rect x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" rx="{r}" {style}/>'


def circle(x, y, d, style=CUT):
    return f'<circle cx="{x:.3f}" cy="{y:.3f}" r="{d / 2:.3f}" {style}/>'


def slot(cx, cy, length, width, horizontal=True):
    """Rounded slot (stadium) centred on cx, cy."""
    w, h = (length, width) if horizontal else (width, length)
    return rect(cx - w / 2, cy - h / 2, w, h, r=min(w, h) / 2)


def text(x, y, s, size=5):
    return f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" {LABEL}>{s}</text>'


# ---------- the parts (each returns SVG in its own local coordinates) ----------
def front_holes():
    """Shared by the front panel and its doubler: window, sensor hole, mounting slots."""
    wx0, wx1 = T + window_x[0], T + window_x[1]
    wy0 = T + WINDOW_TOP
    cx = (wx0 + wx1) / 2
    parts = [rect(wx0, wy0, wx1 - wx0, WINDOW_H, r=2), circle(T + ldr_x, T + win_mid_y, LDR_D)]
    # slots to bolt the scanner housing (or a bracket) anywhere along them
    for y in (T + 18, T + 32, T + WINDOW_TOP + WINDOW_H + 16, T + WINDOW_TOP + WINDOW_H + 30):
        parts.append(slot(cx, y, 50, 4.4))
    return parts


def front():
    s = [poly(outline(X, Y, ("F", "F", "F", "F")))] + front_holes()
    s.append(text(T + 3, Y - 8, "FRONT — this side out, motor side on the left"))
    return s, X, Y


def doubler():
    s = [rect(0, 0, X, Y)] + front_holes()
    s.append(text(4, Y - 8, "FRONT DOUBLER — glue on the front"))
    return s, X, Y


def side(left):
    """Local u = depth from the front edge (0 → Z), v = height from the top edge.
    Every hole is symmetric top/bottom, so either face can go out."""
    zu = lambda z: T + z                      # inner z → local u
    yv = lambda y: T + y                      # inner y → local v
    # back notches for the removable back plate (open towards the back edge)
    s = [poly(side_outline_with_notches(NOTCH_Y))]
    for sy in (TOP_SPOOL_Y, BOT_SPOOL_Y):
        if left:
            s.append(circle(zu(spool_z), yv(sy), MOTOR_SHAFT_HOLE))
            for u in (zu(spool_z + 15), zu(spool_z + 45)):   # cable-tie slots above and below the motor
                s.append(slot(u, yv(sy - 11.25 - 3.5), 6, 2.6))
                s.append(slot(u, yv(sy + 11.25 + 3.5), 6, 2.6))
            s.append(circle(zu(spool_z + MOTOR_REAR + 4), yv(sy), 8))          # motor wires out
            s.append(rect(zu(spool_z - 11.25), yv(sy - 11.25), 70, 22.5, style=MARK))  # where the motor goes
        else:
            s.append(circle(zu(spool_z), yv(sy), AXLE_D))
    for y in (WINDOW_TOP - DOWEL_D, WINDOW_TOP + WINDOW_H + DOWEL_D):
        s.append(circle(zu(dowel_z), yv(y), DOWEL_D + 0.3))
    for y in (win_mid_y - 25, win_mid_y + 25):                                  # diffuser tabs
        s.append(rect(zu(DIFF_Z), yv(y) - 10, T_DIFF, 20))
    s.append(text(T + 30, yv(INNER_H) - 6, "LEFT WALL — motors" if left else "RIGHT WALL — axles"))
    s.append(text(T + 2, T + 8, "front", 4))
    return s, Z, Y


def side_outline_with_notches(notch_y):
    """Side wall outline, then cut the back-plate notches into the plain back edge."""
    pts = outline(Z, Y, ("F", "P", "F", "H"))
    # the back edge is the segment at u = Z; rebuild it with notches
    out = []
    for i, p in enumerate(pts):
        out.append(p)
        q = pts[(i + 1) % len(pts)]
        if abs(p[0] - Z) < 1e-6 and abs(q[0] - Z) < 1e-6 and q[1] > p[1]:
            for ny in notch_y:
                y0, y1 = T + ny, T + ny + 20
                out += [(Z, y0), (Z - T, y0), (Z - T, y1), (Z, y1)]
    return out


def top_bottom(name):
    s = [poly(outline(X, Z, ("H", "H", "P", "H")))]
    s.append(text(T + 4, Z / 2, name))
    s.append(text(T + 4, T + 8, "front edge", 4))
    return s, X, Z


def back_plate():
    w, h = INNER_W, INNER_H - 0.4
    pts = [(0, 0), (w, 0)]
    for ny in NOTCH_Y:                       # tabs into the side-wall notches
        pts += [(w, ny + 0.3), (w + T, ny + 0.3), (w + T, ny + 19.7), (w, ny + 19.7)]
    pts += [(w, h), (0, h)]
    for ny in reversed(NOTCH_Y):
        pts += [(0, ny + 19.7), (-T, ny + 19.7), (-T, ny + 0.3), (0, ny + 0.3)]
    s = [poly(pts)]
    cx, cy = window_x[0] / 2 + window_x[1] / 2, win_mid_y
    s.append(rect(cx - LED_PANEL / 2, cy - LED_PANEL / 2, LED_PANEL, LED_PANEL, style=MARK))
    s.append(slot(cx, cy + LED_PANEL / 2 + 10, 20, 6))                         # LED wires
    s.append(text(4, h - 8, "BACK PLATE — LED matrix on the inside"))
    s.append(text(cx - 14, cy, "8x8 matrix", 4))
    return s, w + 2 * T, h


def diffuser():
    w, h = INNER_W, DIFF_H
    tab_y = (h / 2 - 25 - 10, h / 2 + 25 - 10)
    pts = [(0, 0), (w, 0)]
    for ty in tab_y:
        pts += [(w, ty + 0.2), (w + T, ty + 0.2), (w + T, ty + 19.8), (w, ty + 19.8)]
    pts += [(w, h), (0, h)]
    for ty in reversed(tab_y):
        pts += [(0, ty + 19.8), (-T, ty + 19.8), (-T, ty + 0.2), (0, ty + 0.2)]
    return [poly(pts), text(4, h - 6, "DIFFUSER — 3 mm opal acrylic")], w + 2 * T, h


def joint_test():
    """Two small pieces with the same finger joint, to check the fit before cutting the box."""
    a = [poly(outline(48, 30, ("P", "P", "F", "P"))), text(3, 10, "TEST A", 4)]
    b = [poly(outline(48, 30, ("H", "P", "P", "P"))), text(3, 22, "TEST B", 4)]
    return a, b


# ---------- sheets ----------
def place(items, x, y, rotate=False, shift=0):
    body, w, h = items
    g = "".join(body)
    if rotate:
        return f'<g transform="translate({x + h:.3f},{y:.3f}) rotate(90)"><g transform="translate({shift},0)">{g}</g></g>'
    return f'<g transform="translate({x + shift:.3f},{y:.3f})">{g}</g>'


def sheet(w, h, content, note):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="0 0 {w} {h}">\n'
            f'<!-- {note} -->\n{rect(0, 0, w, h, style=MARK)}\n' + "\n".join(content) + "\n</svg>\n")


HERE = os.path.dirname(os.path.abspath(__file__))
G = 6  # gap between parts
row1 = [place(front(), G, G), place(doubler(), G + X + G, G),
        place(side(True), G + 2 * (X + G), G), place(side(False), G + 2 * (X + G) + Z + G, G)]
y2 = G + Y + G
bx, by = G + 2 * (X + G), y2
back = back_plate()
test_a, test_b = joint_test()
row2 = [place(top_bottom("TOP"), G, y2), place(top_bottom("BOTTOM"), G + X + G, y2),
        place(back, bx, by, rotate=True, shift=T),
        place((test_a, 48, 30), bx + back[2] + G + 4, by), place((test_b, 48, 30), bx + back[2] + G + 4, by + 36)]
width_used = max(G + 2 * (X + G) + 2 * Z + G, bx + back[2] + G + 4 + 48)
height_used = y2 + max(Z, back[1] + 2 * T)
assert width_used <= 600 and height_used <= 400, f"doesn't fit the 600 × 400 bed: {width_used} × {height_used}"

with open(os.path.join(HERE, "cassette_plywood_4mm.svg"), "w") as f:
    f.write(sheet(600, 400, row1 + row2, "4 mm plywood. Red = cut, blue = engrave/score."))
with open(os.path.join(HERE, "cassette_diffuser_3mm.svg"), "w") as f:
    f.write(sheet(200, 140, [place(diffuser(), G + T, G)], "3 mm opal acrylic. Red = cut, blue = engrave."))
print(f"box outer {X} × {Y} × {Z} mm; parts use {width_used:.0f} × {height_used:.0f} mm of the 600 × 400 sheet")
print(f"paper left edge {paper_x0:.1f} mm from the left wall; window {window_x[0]:.1f}–{window_x[1]:.1f}; sensor at {ldr_x:.1f}")
