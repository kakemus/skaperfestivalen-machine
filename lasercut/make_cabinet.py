"""Laser-cut files for the arcade cabinet that holds the cassette, the printer,
the buttons, the bell and the electronics.

  python3 lasercut/make_cabinet.py
  → lasercut/cabinet_1_front_3mm.svg … cabinet_7_divider_2mm.svg  (one file per 565 × 395 laser piece)

Red = cut, blue = engrave/score (part names, where things go). Units are mm.

THE BOX — outer 380 W × 384 H × 260 D (257 + the 3 mm back panel), 3 mm MDF,
finger-jointed like the cassette (same joint code, so the same KERF fits):
  front, left/right side, top, bottom jointed; the back panel bolts on with
  4 M3 bolts into corner blocks (3 glued squares each, the middle one holding
  the nut), so it comes off for the electronics.
INSIDE — a divider wall (2 mm) just right of the cassette's motors (x 162) splits the upper part:
  left: the CASSETTE on a shelf (top surface 150 mm up); the front has an
        opening 4 mm smaller than the cassette all round, so the cassette's own
        front (window, sensor) shows and it stops against that lip. It slides
        in from the back.
  right: the PRINTER on a shelf (233 up) and two pairs of wedges that raise its
        front 25 mm, so its sloping top becomes level. The top panel has an
        opening above it, the printer's top rises into it (1 mm below the
        surface), and a lift-off LID lies on top with cut-outs for the paper
        mouth and the cover lever: the paper travels ~4 mm to the outside, no
        guide needed. Lid off → the printer's own cover opens up through the
        opening for a new roll.
  below the shelves: the BAY, full width (the divider is open there): buttons
        at the front (with a doubler behind the front panel), the bell against
        the right wall (grille slots in the side), Wukong + micro:bit, relay,
        battery, phone and power bank — placement marks engraved on the bottom.

Everything is computed from the numbers below; change one and re-run.
Measured on the maker's parts (2026-10-15/16): printer 190 W × 140 D, 125 front /
150 back high; paper mouth 100 × 35 starting 17 mm from the printer's left;
cover lever 45 × 20 × 10 high, ending 22 mm from its right; cassette 123 × 95 × 216.
The mouth's front edge is 35 mm behind the printer's front (measured).
"""
import os

# ---------- numbers ----------
T = 3.0              # MDF for the box, shelves, lid
T2 = 2.0             # MDF for the divider wall
SHEET_W, SHEET_H = 565.0, 395.0   # the laser pieces cut from the big boards

X, Y = 380.0, 384.0  # outer width, height
Z = 257.0            # depth of front + sides/top/bottom (the back panel adds T behind)

# cassette (left column)
CAS_W, CAS_D, CAS_H = 123.0, 95.0, 216.0
CAS_X = 10.0         # its left side, from the box's outer left
CAS_SHELF = 150.0    # top surface of its shelf, from the outer bottom
LIP = 4.0            # front opening is this much smaller than the cassette on every side

CAS_MOTORS = 25.0    # the TT motors stick out of the cassette's RIGHT side (seen from the front), measured 2026-10-16
DIV_X = CAS_X + CAS_W + CAS_MOTORS + 4   # divider wall's left face (thickness T2): 4 mm past the motors

# printer (right column)
PR_W, PR_D = 190.0, 140.0
PR_FRONT_H, PR_BACK_H = 125.0, 150.0
PR_X = DIV_X + T2 + 6   # its left side
PR_Z = 11.0          # its front, from the box's outer front (behind the top panel's front strip)
PR_TOP = Y - 1.0     # where its (levelled) top ends up: 1 mm under the top surface
MOUTH_X, MOUTH_W, MOUTH_D = 17.0, 100.0, 35.0          # from the printer's left; size
MOUTH_FROM_FRONT = 35.0   # mouth's front edge behind the printer's front (measured by the maker, 2026-10-16)
LEVER_W, LEVER_D = 45.0, 20.0
LEVER_FROM_RIGHT = 22.0                                  # lever's right end, from the printer's right
LEVER_FROM_FRONT = 58.0                                  # lever's front edge behind the printer's front (measured)
CUT_MARGIN = 2.0     # around the mouth / lever cut-outs (the paper wanders a little)

# front
BUTTON_D = 27.5
BUTTONS_X = (120.0, 260.0)
BUTTON_Y = 75.0      # from the outer bottom
DOUBLER = (60.0, 35.0, 260.0, 80.0)   # x, y (from bottom), w, h behind the front panel

# tabs of shelves / divider into the walls
TAB_L = 20.0
SHELF_TABS = (60.0, 190.0)            # along the depth, from the shelf's front edge
DIV_TABS = (50.0, 200.0)

# back panel corner blocks
BLOCK = 20.0
M3_HOLE = 3.4
M3_NUT_AF = 5.7      # hexagon across flats (M3 nut is 5.5)
NUT_RECUT_AF = 6.1   # the recut squares: roomier, since 5.7 came out too small even without kerf
                     # offset (2026-10-16). Must stay under the nut's 6.35 across corners, so it can't turn.

# ---------- derived ----------
IN_TOP = Y - T                        # inner top (underside of the top panel), from the bottom
SHELF_PR = PR_TOP - PR_BACK_H         # printer shelf top: the printer's back sits on it
WEDGE = PR_BACK_H - PR_FRONT_H        # front raised by this (25)
opening = (PR_X - 2, PR_Z - 2, PR_W + 4, PR_D + 4)   # top panel opening x, z, w, d — the printer rises into it
LID = (opening[0] - 13, 2.0, opening[2] + 26, 170.0) # lid x, z, w, d — overlaps the opening

assert CAS_SHELF + CAS_H < IN_TOP - 5, "cassette doesn't fit under the top"
assert CAS_X + CAS_W + CAS_MOTORS < DIV_X - 2 and CAS_X > T + 2, "cassette + motors don't fit between the left wall and the divider"
assert PR_X > DIV_X + T2 + 2 and PR_X + PR_W < X - T - 10, "printer doesn't fit in its column"
assert opening[1] > T + T + 2, "printer opening runs into the top panel's front joint"
assert LID[1] + LID[3] < Z - 10 and LID[0] + LID[2] < X - T, "lid too big"
assert SHELF_PR > CAS_SHELF, "printer shelf below the cassette shelf?"

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------- finger joints (the cassette's, unchanged) ----------
def segments(length):
    n = max(3, round(length / 16))
    return n + 1 if n % 2 == 0 else n


def depths(kind, length):
    if kind == "P":
        return [0.0]
    n = segments(length)
    out_even = kind == "F"
    return [0.0 if (i % 2 == 0) == out_even else T for i in range(n)]


def outline(w, h, kinds):
    """kinds = (top, right, bottom, left) of a w × h face, y down: 'F' fingers out at
    the ends, 'H' the complement, 'P' plain."""
    lengths = (w, h, w, h)
    ds = [depths(k, L) for k, L in zip(kinds, lengths)]

    def at(edge, s, d):
        return [(s, d), (w - d, s), (w - s, h - d), (d, h - s)][edge]

    pts = []
    for e in range(4):
        L, dd = lengths[e], ds[e]
        n = len(dd)
        seg = L / n
        s0 = ds[(e - 1) % 4][-1]
        s1 = L - ds[(e + 1) % 4][0]
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


def poly(pts, style=CUT):
    return f'<polygon points="{" ".join(f"{x:.3f},{y:.3f}" for x, y in pts)}" {style}/>'


def rect(x, y, w, h, style=CUT, r=0):
    return f'<rect x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" rx="{r}" {style}/>'


def circle(x, y, d, style=CUT):
    return f'<circle cx="{x:.3f}" cy="{y:.3f}" r="{d / 2:.3f}" {style}/>'


def slot(cx, cy, w, h):
    return rect(cx - w / 2, cy - h / 2, w, h, r=min(w, h) / 2)


def text(x, y, s, size=6):
    return f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" {LABEL}>{s}</text>'


def hexagon(cx, cy, af):
    import math
    r = af / 2 / math.cos(math.pi / 6)
    return poly([(cx + r * math.cos(math.pi / 3 * i), cy + r * math.sin(math.pi / 3 * i)) for i in range(6)])


def tab_slot(cx, cy, along_x, thick):
    """A slot for a shelf/divider tab: TAB_L long, `thick` wide (+ clearance)."""
    return rect(cx - (TAB_L + 0.2) / 2, cy - (thick + 0.2) / 2, TAB_L + 0.2, thick + 0.2) if along_x else \
        rect(cx - (thick + 0.2) / 2, cy - (TAB_L + 0.2) / 2, thick + 0.2, TAB_L + 0.2)


def tabbed(w, h, left=(), right=(), top=(), bottom=(), out_l=T, out_r=T, out_t=T, out_b=T):
    """A w × h plate with tabs (centred at the given positions) sticking out of its edges.
    Local origin at the plate's top-left (tabs go to negative coordinates)."""
    pts = [(0, 0)]
    for c in sorted(top):
        pts += [(c - TAB_L / 2, 0), (c - TAB_L / 2, -out_t), (c + TAB_L / 2, -out_t), (c + TAB_L / 2, 0)]
    pts.append((w, 0))
    for c in sorted(right):
        pts += [(w, c - TAB_L / 2), (w + out_r, c - TAB_L / 2), (w + out_r, c + TAB_L / 2), (w, c + TAB_L / 2)]
    pts.append((w, h))
    for c in sorted(bottom, reverse=True):
        pts += [(c + TAB_L / 2, h), (c + TAB_L / 2, h + out_b), (c - TAB_L / 2, h + out_b), (c - TAB_L / 2, h)]
    pts.append((0, h))
    for c in sorted(left, reverse=True):
        pts += [(0, c + TAB_L / 2), (-out_l, c + TAB_L / 2), (-out_l, c - TAB_L / 2), (0, c - TAB_L / 2)]
    return pts


# Coordinates: x from the outer left, y_up from the outer bottom, z from the outer front.
v_front = lambda y_up: Y - y_up            # front/back/side panels: local v from their top edge


# ---------- parts: each returns (svg list, w, h, x0, y0) — x0/y0 = how far tabs stick out up/left ----------
def front():
    s = [poly(outline(X, Y, ("F", "F", "F", "F")))]
    x0, x1 = CAS_X + LIP, CAS_X + CAS_W - LIP
    s.append(rect(x0, v_front(CAS_SHELF + CAS_H - LIP), x1 - x0, CAS_H - 2 * LIP, r=2))
    for bx in BUTTONS_X:
        s.append(circle(bx, v_front(BUTTON_Y), BUTTON_D))
    dx, dy, dw, dh = DOUBLER
    s.append(rect(dx, v_front(dy + dh), dw, dh, style=MARK))
    s.append(text(T + 6, Y - 10, "FRONT — this face out. Blue box: glue the button doubler behind."))
    s.append(text(x0 + 4, v_front(CAS_SHELF + CAS_H - LIP) + 10, "cassette window", 5))
    return s, X, Y, 0, 0


def doubler():
    dx, dy, dw, dh = DOUBLER
    s = [rect(0, 0, dw, dh)]
    for bx in BUTTONS_X:
        s.append(circle(bx - dx, (dy + dh) - BUTTON_Y, BUTTON_D))
    s.append(text(4, dh - 5, "BUTTON DOUBLER — glue behind the front", 5))
    return s, dw, dh, 0, 0


def side(right):
    """Local u = depth from the front edge, v from the top. Front edge = 'H' (into the front's fingers)."""
    s = [poly(outline(Z, Y, ("F", "P", "F", "H")))]
    shelf_y = SHELF_PR if right else CAS_SHELF                  # top surface of the shelf it carries
    for t in SHELF_TABS:
        s.append(tab_slot(T + t, v_front(shelf_y) + T / 2, True, T))
    if right:   # bell grille: horizontal slots over where the bell stands
        for i in range(10):
            s.append(slot(130, v_front(140) + 6 + i * 12, 110, 5))
        s.append(text(T + 8, Y - 10, "RIGHT SIDE — front edge on the left when seen from outside"))
        s.append(text(75, v_front(140) - 4, "bell grille", 5))
    else:
        s.append(text(T + 8, Y - 10, "LEFT SIDE — front edge on the right when seen from outside"))
    s.append(text(T + 4, T + 10, "front", 5))
    return s, Z, Y, 0, 0


def top():
    """Local u = x, v = depth z from the front edge."""
    s = [poly(outline(X, Z, ("H", "H", "P", "H")))]
    ox, oz, ow, od = opening
    s.append(rect(ox, oz, ow, od, r=2))
    for t in DIV_TABS:
        s.append(tab_slot(DIV_X + T2 / 2, T + t, False, T2))
    lx, lz, lw, ld = LID
    s.append(rect(lx, lz, lw, ld, style=MARK))
    s.append(text(T + 6, Z - 10, "TOP — front edge at the top here. Blue: where the lid lies."))
    s.append(text(ox + 6, oz + od - 8, "printer rises into this opening", 5))
    return s, X, Z, 0, 0


def bottom():
    s = [poly(outline(X, Z, ("H", "H", "P", "H")))]
    for t in DIV_TABS:
        s.append(tab_slot(DIV_X + T2 / 2, T + t, False, T2))
    bx = DIV_X + T2 + 8          # the bay right of the divider's bottom rail
    zones = [   # x, z, w, d, label — what stands where in the bay (engraved)
        (X - T - 45, 90, 45, 80, "BELL"),
        (bx, 80, 75, 160, "PHONE"),
        (bx + 85, 200, 60, 40, "WUKONG"),
        (bx + 85, 150, 25, 35, "RELAY"),
        (bx + 120, 150, 25, 15, "9V"),
        (25, 100, 70, 140, "POWER BANK"),
    ]
    for x, z, w, d, name in zones:
        assert x + w <= X - T and (x + w <= DIV_X or x >= DIV_X + T2), name + " crosses the divider or the wall"
    for x, z, w, d, name in zones:
        s.append(rect(x, z, w, d, style=MARK))
        s.append(text(x + 2, z + 8, name, 5))
    s.append(text(T + 6, Z - 10, "BOTTOM — front edge at the top here; marks face up (inside)"))
    return s, X, Z, 0, 0


def back():
    s = [rect(0, 0, X, Y)]
    for cx in (T + BLOCK / 2, X - T - BLOCK / 2):
        for cy in (T + BLOCK / 2, Y - T - BLOCK / 2):
            s.append(circle(cx, cy, M3_HOLE))
    s.append(circle(X - 40, Y - 45, 30))                         # cables out
    s.append(text(T + 8, Y - 10, "BACK — M3 bolts (10–20 mm) into the corner blocks"))
    s.append(text(X - 62, Y - 66, "cables", 5))
    return s, X, Y, 0, 0


def cassette_shelf():
    """Spans the left wall (tabs T out) to the divider (tabs T2 out). Local u = x, v = depth."""
    w, d = DIV_X - T, Z - T
    pts = tabbed(w, d, left=[t for t in SHELF_TABS], right=[t for t in SHELF_TABS], out_l=T, out_r=T2)
    # tabbed() puts left/right tabs along v (depth): positions measured from the front edge
    return [poly(pts), text(8, d / 2, "CASSETTE SHELF", 6), text(8, 10, "front", 5)], w, d, T, 0


def printer_shelf():
    w, d = X - T - (DIV_X + T2), Z - T
    pts = tabbed(w, d, left=list(SHELF_TABS), right=list(SHELF_TABS), out_l=T2, out_r=T)
    s = [poly(pts), text(8, d / 2, "PRINTER SHELF", 6), text(8, 10, "front", 5)]
    px = PR_X - (DIV_X + T2)
    s.append(rect(px, PR_Z - T, PR_W, PR_D, style=MARK))        # where the printer stands
    for wx in (px + 8, px + PR_W - 8 - 2 * T):                   # where the wedge pairs go
        s.append(rect(wx, PR_Z - T, 2 * T, PR_D, style=MARK))
    s.append(text(px + 4, PR_Z - T + 14, "printer (wedges under its sides, high end at the front)", 4))
    return s, w, d, T, 0      # tabs stick out T2 left, T right: reserve T both sides


def divider():
    """Local u = depth from the front inner face, v from the inner top. Tabs into top and bottom.
    Open at the bottom (the bay); notched at the front for the button doubler."""
    w, h = Z - T, IN_TOP - T
    pts = tabbed(w, h, top=list(DIV_TABS), bottom=list(DIV_TABS), out_t=T, out_b=T)
    # notch for the doubler (front edge, its height range)
    dy0, dy1 = DOUBLER[1], DOUBLER[1] + DOUBLER[3]
    v0, v1 = IN_TOP - dy1, IN_TOP - dy0
    out = []
    for p in pts:
        out.append(p)
    i = out.index((0, h))
    out[i + 1:i + 1] = [(0, v1 + 1), (T + 0.5, v1 + 1), (T + 0.5, v0 - 1), (0, v0 - 1)]
    s = [poly(out)]
    # slots for the shelves' tabs
    for t in SHELF_TABS:
        s.append(tab_slot(t, IN_TOP - CAS_SHELF + T / 2, True, T))
        s.append(tab_slot(t, IN_TOP - SHELF_PR + T / 2, True, T))
    # the bay: open, leaving a frame
    s.append(rect(15, IN_TOP - (CAS_SHELF - 15), w - 30, CAS_SHELF - 15 - 15 - T, r=6))
    s.append(text(8, 14, "DIVIDER (2 mm) — front edge on the left; cassette motors on its left", 6))
    s.append(text(8, IN_TOP - CAS_SHELF - 4, "cassette shelf on the LEFT face, printer shelf on the RIGHT", 4))
    return s, w, h, 0, T


def lid():
    lx, lz, lw, ld = LID
    # outline with a half-circle finger notch bitten out of the back edge — a whole
    # circle on the edge also cut into whatever lay next to the lid on the sheet
    # (the bottom panel, 2026-10-16)
    c, r = lw / 2, 13
    s = [f'<path d="M0,0 H{lw:.3f} V{ld:.3f} H{c + r:.3f} A{r},{r} 0 0 0 {c - r:.3f},{ld:.3f} H0 Z" {CUT}/>']
    mx0 = PR_X + MOUTH_X - CUT_MARGIN - lx
    mz0 = PR_Z + MOUTH_FROM_FRONT - CUT_MARGIN - lz
    s.append(rect(mx0, mz0, MOUTH_W + 2 * CUT_MARGIN, MOUTH_D + 2 * CUT_MARGIN, r=2))
    lever_x = PR_X + PR_W - LEVER_FROM_RIGHT - LEVER_W
    s.append(rect(lever_x - CUT_MARGIN - lx, PR_Z + LEVER_FROM_FRONT - CUT_MARGIN - lz,
                  LEVER_W + 2 * CUT_MARGIN, LEVER_D + 2 * CUT_MARGIN, r=2))
    s.append(text(6, ld - 20, "LID — lies on the top; cleats underside drop into the opening", 4.5))
    s.append(text(mx0 + 4, mz0 + 10, "paper", 5))
    return s, lw, ld, 0, 0


def small_parts():
    """Wedges (4: two glued pairs), lid cleats (4), corner blocks (12), joint test (2)."""
    items = []
    for i in range(4):
        items.append(([poly([(0, 0), (PR_D, WEDGE), (0, WEDGE)]), text(3, WEDGE - 4, "WEDGE", 4)], PR_D, WEDGE))
    for i in range(4):
        items.append(([rect(0, 0, 12, 12)], 12, 12))
    for i in range(12):
        hexed = i % 3 == 1
        body = [rect(0, 0, BLOCK, BLOCK), hexagon(BLOCK / 2, BLOCK / 2, M3_NUT_AF) if hexed else circle(BLOCK / 2, BLOCK / 2, M3_HOLE)]
        items.append((body, BLOCK, BLOCK))
    items.append(([poly(outline(48, 30, ("P", "P", "F", "P"))), text(3, 10, "TEST A", 4)], 48, 30))
    items.append(([poly(outline(48, 30, ("H", "P", "P", "P"))), text(3, 22, "TEST B", 4)], 48, 30))
    return items


# ---------- sheets ----------
M = 3.0      # margin to the sheet edge
G = 4.0      # gap between parts


class Sheet:
    def __init__(self, name, note):
        self.name, self.note, self.body, self.boxes = name, note, [], []

    def add(self, part, x, y, rotate=False):
        """Place a part with its outline's top-left (incl. sticking-out tabs) at x, y."""
        body, w, h, ox, oy = part
        tw, th = w + 2 * ox, h + 2 * oy          # tabs can stick out on both sides
        g = "".join(body)
        if rotate:
            self.body.append(f'<g transform="translate({x + th - oy:.3f},{y + ox:.3f}) rotate(90)">{g}</g>')
            tw, th = th, tw
        else:
            self.body.append(f'<g transform="translate({x + ox:.3f},{y + oy:.3f})">{g}</g>')
        self.check(x, y, tw, th)
        return x + tw, y + th

    def check(self, x, y, w, h):
        assert x >= M - 1e-6 and y >= M - 1e-6 and x + w <= SHEET_W - M + 1e-6 and y + h <= SHEET_H - M + 1e-6, \
            f"{self.name}: part at {x:.0f},{y:.0f} size {w:.0f}×{h:.0f} leaves the {SHEET_W:.0f} × {SHEET_H:.0f} piece"
        for bx, by, bw, bh in self.boxes:
            assert x + w <= bx or bx + bw <= x or y + h <= by or by + bh <= y, f"{self.name}: parts overlap"
        self.boxes.append((x, y, w, h))

    def write(self):
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SHEET_W}mm" height="{SHEET_H}mm" '
               f'viewBox="0 0 {SHEET_W} {SHEET_H}">\n<!-- {self.note} -->\n'
               f'{rect(0, 0, SHEET_W, SHEET_H, style=MARK)}\n' + "\n".join(self.body) + "\n</svg>\n")
        with open(os.path.join(HERE, self.name), "w") as f:
            f.write(svg)


def build():
    sheets = []
    s1 = Sheet("cabinet_1_front_3mm.svg", "3 mm MDF: front + cassette shelf")
    s1.add(front(), M, (SHEET_H - Y) / 2)
    s1.add(cassette_shelf(), M + X + G, M)
    sheets.append(s1)

    s2 = Sheet("cabinet_2_back_3mm.svg", "3 mm MDF: back + button doubler + joint test + corner blocks")
    s2.add(back(), M, (SHEET_H - Y) / 2)
    small = small_parts()
    x = M + X + G
    s2.add((small[-2][0], 48, 30, 0, 0), x, M)                                   # joint test A
    s2.add((small[-1][0], 48, 30, 0, 0), x, M + 30 + G)                          # joint test B
    s2.add(doubler(), x, M + 2 * (30 + G), rotate=True)
    bx = x + DOUBLER[3] + G
    by = M
    for body, w, h in small[8:20]:                                                # 12 corner blocks
        if by + h > SHEET_H - M:
            bx, by = bx + BLOCK + G, M
        s2.add((body, w, h, 0, 0), bx, by)
        by += h + G
    sheets.append(s2)

    s3 = Sheet("cabinet_3_sides_3mm.svg", "3 mm MDF: left + right side")
    s3.add(side(False), M, (SHEET_H - Y) / 2)
    s3.add(side(True), M + Z + G, (SHEET_H - Y) / 2)
    sheets.append(s3)

    s4 = Sheet("cabinet_4_bottom_lid_3mm.svg", "3 mm MDF: bottom + lid + lid cleats")
    s4.add(bottom(), M, M)
    lx = M + X + G
    s4.add(lid(), lx, M, rotate=True)
    cy = M + LID[2] + G
    for i, (body, w, h) in enumerate(small[4:8]):
        s4.add((body, w, h, 0, 0), lx + i * (12 + G), cy)
    sheets.append(s4)

    s5 = Sheet("cabinet_5_top_3mm.svg", "3 mm MDF: top")
    s5.add(top(), M, M)
    sheets.append(s5)

    s6 = Sheet("cabinet_6_printer_shelf_3mm.svg", "3 mm MDF: printer shelf + wedges")
    s6.add(printer_shelf(), M, M)
    wx = M + (X - T - DIV_X - T2) + 2 * T + G + 2
    for i, (body, w, h) in enumerate(small[0:4]):
        s6.add((body, w, h, 0, 0), wx, M + i * (WEDGE + G))
    sheets.append(s6)

    s7 = Sheet("cabinet_7_divider_2mm.svg", "2 mm MDF: divider wall")
    s7.add(divider(), M, M)
    sheets.append(s7)

    for s in sheets:
        s.write()
    hex_recut()
    button_recut()
    front_mirrored_sheet()
    test_sheet()
    lid_ramp_sheet()
    display_holder_sheet()
    button_signs_sheet()
    return sheets


# ---------- JA / NEI signs for the console (2026-10-21) ----------
# The user test: people didn't know which button was which. Two 30 x 20 mm plaques, glued next to
# the buttons (JA = left, NEI = right, seen from the front). The letters are engraved FILLED (blue
# fill = engrave/fill layer), drawn as plain block-letter polygons — no font needed in the laser
# software. Glue them on after painting, so the burnt letters stay dark on the bare MDF.
SIGN_W, SIGN_H = 30.0, 20.0
CAP, STEM = 11.0, 2.4      # letter height, stroke
LETTERS = {               # each letter: (width, [polygons]); y down from the letter's top
    "J": (6.5, [[(4.1, 0), (6.5, 0), (6.5, 8.2), (5.4, 10.4), (3.25, 11), (1.1, 10.4), (0, 8.2), (0, 7.4),
                 (2.4, 7.4), (2.4, 8.2), (3.25, 8.6), (4.1, 8.2)]]),
    "A": (8.4, [[(3.0, 0), (5.4, 0), (8.4, 11), (6.0, 11), (5.4, 8.8), (3.0, 8.8), (2.4, 11), (0, 11)],
                [(4.2, 2.6), (4.95, 6.6), (3.45, 6.6)]]),                     # the counter (a hole)
    "N": (7.6, [[(0, 0), (2.4, 0), (5.2, 6.9), (5.2, 0), (7.6, 0), (7.6, 11), (5.2, 11), (2.4, 4.1), (2.4, 11), (0, 11)]]),
    "E": (6.4, [[(0, 0), (6.4, 0), (6.4, 2.4), (2.4, 2.4), (2.4, 4.3), (5.6, 4.3), (5.6, 6.7), (2.4, 6.7),
                 (2.4, 8.6), (6.4, 8.6), (6.4, 11), (0, 11)]]),
    "I": (2.4, [[(0, 0), (2.4, 0), (2.4, 11), (0, 11)]]),
}
ENGRAVE_FILL = 'fill="#0000ff" fill-rule="evenodd" stroke="none"'


def sign(word):
    gap = 1.6
    width = sum(LETTERS[c][0] for c in word) + gap * (len(word) - 1)
    x, y = (SIGN_W - width) / 2, (SIGN_H - CAP) / 2
    parts = [rect(0, 0, SIGN_W, SIGN_H, r=2)]
    for c in word:
        w, polys = LETTERS[c]
        d = " ".join("M" + " L".join(f"{x + px:.3f},{y + py:.3f}" for px, py in poly) + " Z" for poly in polys)
        parts.append(f'<path d="{d}" {ENGRAVE_FILL}/>')
        x += w + gap
    return parts, SIGN_W, SIGN_H, 0, 0


def button_signs_sheet():
    sh = Sheet("cabinet_15_button_signs_3mm.svg", "3 mm MDF: JA / NEI signs (30 x 20 mm), two of each - letters engraved filled (blue), outline cut (red)")
    for i, word in enumerate(["JA", "NEI", "JA", "NEI"]):              # a spare of each
        sh.add(sign(word), M + (i % 2) * (SIGN_W + G), M + (i // 2) * (SIGN_H + G))
    sh.write()


# ---------- a holder for the IBM display's pole (2026-10-21) ----------
# The display hangs from its pole (foot up, head down — the text then reads the right way),
# its top edge ~100 mm under the box's top edge, so the foot ends up ~11 cm above the box and
# clear of the lid. The foot can't come off and the head is at the other end, so the pole can't
# go through closed rings: two U-shaped arms open at the front, the pole pressed in and held by
# a strap (velcro / cable tie) through slots in the arms. The arms are two layers each (6 mm),
# tabbed into a mounting plate that is glued to the front panel's top where the maker wants it.
POLE_D = 39.0
POLE_GAP = 1.0           # the U is this much wider than the pole
POLE_OUT = 30.0          # the pole's axis from the mounting plate's front face
HOLDER_W, HOLDER_H = 70.0, 85.0
ARM_LEVELS = (12.0, 70.0)    # the arms' middles, from the mounting plate's top edge
ARM_T = 2 * T            # two layers glued
ARM_TABS = (-18.0, 18.0)     # tab centres across the arm
ARM_TAB = 15.0


def display_holder_parts():
    import math
    r = (POLE_D + POLE_GAP) / 2
    plate = [rect(0, 0, HOLDER_W, HOLDER_H)]
    for lv in ARM_LEVELS:
        for tx in ARM_TABS:
            plate.append(rect(HOLDER_W / 2 + tx - (ARM_TAB + 0.2) / 2, lv - (ARM_T + 0.2) / 2, ARM_TAB + 0.2, ARM_T + 0.2))
    plate.append(text(4, HOLDER_H - 9, "POLE HOLDER", 4))
    plate.append(text(4, HOLDER_H - 4, "this face out, top up", 4))
    # an arm seen from above: x across (0 = middle), z forward from the plate; tabs stick back
    depth = POLE_OUT + r * 0.75 + 6                                # the horns reach past the pole's middle
    half = HOLDER_W / 2
    pts = [(-half, 0)]
    for tx in ARM_TABS:
        pts += [(tx - ARM_TAB / 2, 0), (tx - ARM_TAB / 2, -T), (tx + ARM_TAB / 2, -T), (tx + ARM_TAB / 2, 0)]
    pts += [(half, 0), (half, depth), (r, depth), (r, POLE_OUT)]
    for i in range(1, 24):                                          # the round back of the U
        a = math.pi * i / 24
        pts.append((r * math.cos(a), POLE_OUT - r * math.sin(a)))
    pts += [(-r, POLE_OUT), (-r, depth), (-half, depth)]
    sx = lambda x, z: (x + half, z + T)                             # into SVG coordinates
    arm = [poly([sx(x, z) for x, z in pts])]
    hx = (half + r) / 2                                             # strap slots, in the horns
    for x in (-hx, hx):
        arm.append(rect(*sx(x - 2, POLE_OUT), 4, 10, r=1))
    return (plate, HOLDER_W, HOLDER_H, 0, 0), (arm, HOLDER_W, depth + T, 0, 0)


# The arms only keep the pole upright; the display's weight would hang on the strap's grip
# alone and could creep down. So a small shelf goes under the display (its underside is flat):
# a back plate glued to the front panel, the shelf (two layers) tabbed into it, two triangle
# braces under it. The display just rests on it — that sets the height too.
SHELF_W, SHELF_D = 70.0, 50.0
SHELF_BACK_H = 50.0
SHELF_BRACE = 35.0


def display_shelf_parts():
    tabs = (-20.0, 20.0)
    back = [rect(0, 0, SHELF_W, SHELF_BACK_H)]
    for tx in tabs:                                                  # the shelf's tabs, near the top
        back.append(rect(SHELF_W / 2 + tx - (ARM_TAB + 0.2) / 2, 6 - 0.1, ARM_TAB + 0.2, ARM_T + 0.2))
    under = 6 + ARM_T                                                # the shelf's underside on the back plate
    for bx in (6.0, SHELF_W - 6.0 - T):                             # the braces' tabs: 16–31 mm below their top
        back.append(rect(bx - 0.1, under + SHELF_BRACE - 19 - 0.1, T + 0.2, 15.2))
    back.append(text(4, SHELF_BACK_H - 4, "DISPLAY SHELF - this face out", 3.5))
    half = SHELF_W / 2
    pts = [(-half, 0)]
    for tx in tabs:
        pts += [(tx - ARM_TAB / 2, 0), (tx - ARM_TAB / 2, -T), (tx + ARM_TAB / 2, -T), (tx + ARM_TAB / 2, 0)]
    pts += [(half, 0), (half, SHELF_D), (-half, SHELF_D)]
    shelf = [poly([(x + half, z + T) for x, z in pts])]
    # brace: a right triangle, its upright edge against the back plate (with a tab into it),
    # its top edge under the shelf
    b = SHELF_BRACE
    brace = [poly([(T, 0), (T + b, 0), (T, b), (T, b - 4), (0, b - 4), (0, b - 19), (T, b - 19)])]
    return (back, SHELF_W, SHELF_BACK_H, 0, 0), (shelf, SHELF_W, SHELF_D + T, 0, 0), (brace, b + T, b, 0, 0)


def display_holder_sheet():
    plate, arm = display_holder_parts()
    sh = Sheet("cabinet_14_display_holder_3mm.svg", "3 mm MDF: holder for the IBM display's pole - mounting plate + 4 arm layers (glue them in pairs)")
    sh.add(plate, M, M)
    for i in range(4):
        sh.add(arm, M + HOLDER_W + G + (i % 2) * (HOLDER_W + G), M + (i // 2) * (arm[2] + G))
    back, shelf, brace = display_shelf_parts()
    y0 = M + 2 * (arm[2] + G)
    sh.add(back, M, y0)
    sh.add(shelf, M + SHELF_W + G, y0)
    sh.add(shelf, M + 2 * (SHELF_W + G), y0)
    sh.add(brace, M + 3 * (SHELF_W + G), y0)
    sh.add(brace, M + 3 * (SHELF_W + G) + brace[1] + G, y0)
    sh.write()


# ---------- the new lid with a paper ramp (2026-10-21) ----------
# On the machine the receipt came up out of the slot and fell backwards, flat on the lid.
# A backrest just behind the slot, leaning back RAMP_LEAN, holds it up facing the player;
# two triangle braces behind it hold the angle. The lever cut-out is gone. The paper slot is
# centred across the lid and smaller (the maker, from a photo of the old lid: "depth is good",
# the printer can be shifted to line up), with its centre line where the old slot's was.
# Lid-local u = from its left edge, v = from its front edge; the engraving reads from the front.
SLOT_W, SLOT_D = 92.0, 32.0   # the paper slot (paper 80 mm wide; the old cut-out was 104 x 39)
RAMP_H = 120.0           # backrest height (along its face)
RAMP_LEAN = 15.0         # leaning back from upright, degrees
RAMP_MARGIN = 10.0       # backrest wider than the slot on each side
BRACE_BASE = 50.0        # triangle braces: their foot on the lid
BRACE_H = 90.0           # … and how far up the backrest they reach


def lid_ramp_parts():
    import math
    lx, lz, lw, ld = LID
    mw, md = SLOT_W, SLOT_D
    mu = (lw - mw) / 2                                              # centred across the lid
    mv = PR_Z + MOUTH_FROM_FRONT - lz + MOUTH_D / 2 - md / 2       # same centre line as the old slot
    c, r = lw / 2, 13
    lid = [f'<path d="M0,0 H{lw:.3f} V{ld:.3f} H{c + r:.3f} A{r},{r} 0 0 0 {c - r:.3f},{ld:.3f} H0 Z" {CUT}/>',
           rect(mu, mv, mw, md, r=2)]
    # the backrest stands on the lid just behind the slot; its tabs go through at the lean,
    # so their slots are wider than the plate is thick
    pw = mw + 2 * RAMP_MARGIN
    pu, pv = mu - RAMP_MARGIN, mv + md + 4.0                       # its left end, its front face's foot (4 mm of lid left behind the slot)
    lean = math.radians(RAMP_LEAN)
    slot_v = T / math.cos(lean) + T * math.tan(lean) + 0.4
    tabs = (25.0, pw - 25.0)
    for t in tabs:
        lid.append(rect(pu + t - (TAB_L + 0.2) / 2, pv, TAB_L + 0.2, slot_v))
    # brace slots: just inside the backrest's ends, running back from it
    bv0 = pv + T / math.cos(lean)                                  # behind the backrest at the foot
    for bu in (pu + T, pu + pw - 2 * T):
        lid.append(rect(bu - 0.1, bv0 + BRACE_BASE / 2 - (TAB_L + 0.2) / 2, T + 0.2, TAB_L + 0.2))
    # turned 180°, so it reads standing in front of the machine
    lid.append(f'<g transform="rotate(180 {lw / 2:.3f} {ld / 2:.3f})">{text(30, 20, "LID - this face up. Ramp behind the paper slot, notch at the back.", 4.5)}</g>')
    plate = [poly(tabbed(pw, RAMP_H, bottom=list(tabs))), text(6, 12, "RAMP - smooth face to the front", 4.5)]
    # brace: foot BRACE_BASE on the lid, front edge along the backrest's back (leaning back)
    top_u = BRACE_H * math.tan(lean)
    pts = [(0, 0), (BRACE_BASE / 2 - TAB_L / 2, 0), (BRACE_BASE / 2 - TAB_L / 2, -T), (BRACE_BASE / 2 + TAB_L / 2, -T),
           (BRACE_BASE / 2 + TAB_L / 2, 0), (BRACE_BASE, 0), (top_u, BRACE_H)]
    brace_w = max(BRACE_BASE, top_u)
    brace = [poly([(x, BRACE_H - y) for x, y in pts])]              # y up → SVG y down
    return (lid, lw, ld, 0, 0), (plate, pw, RAMP_H, 0, 0), (brace, brace_w, BRACE_H, 0, 0)


def lid_ramp_sheet():
    lid, plate, brace = lid_ramp_parts()
    sh = Sheet("cabinet_13_lid_ramp_3mm.svg", "3 mm MDF: new printer lid with a paper ramp (backrest + 2 braces) + 4 cleats")
    sh.add(lid, M, M)
    x = M + LID[2] + G
    _, y = sh.add((plate[0], plate[1], plate[2] + T, 0, 0), x, M)   # +T: the tabs stick out below
    sh.add((brace[0], brace[1], brace[2] + T, 0, 0), x, y + G)
    sh.add((brace[0], brace[1], brace[2] + T, 0, 0), x + brace[1] + G, y + G)
    for i in range(4):
        sh.add(([rect(0, 0, 12, 12)], 12, 12, 0, 0), M + i * (12 + G), M + LID[3] + G)
    sh.write()


def test_sheet():
    """Test pieces for the new front + console (2026-10-19), cut with the same laser
    settings as the real sheets: the box's finger joint (TEST A + B, as on sheet 2),
    the console's tab-in-notch joint (TAB + NOTCH: the tab should press in and sit
    flush), and one button hole (BUTTON: a 30 mm hole, green like the real ones)."""
    w, h = 4 * 48 + 3 * G + 2 * M, 30 + 2 * M + 3 + 50 + G
    parts = []
    small = small_parts()
    def put(body, x, y):
        parts.append(f'<g transform="translate({x:.3f},{y:.3f})">{"".join(body)}</g>')
    put(small[-2][0], M, M)                                   # TEST A (fingers)
    put(small[-1][0], M + 48 + G, M)                          # TEST B
    tab = poly(tabbed(40, 30, right=[15], out_r=T))           # a plate with one tab, like the console's
    put([tab, text(3, 10, "TAB", 4)], M + 2 * (48 + G), M)
    notch = poly([(0, 0), (40, 0), (40, 5), (40 - T, 5), (40 - T, 25), (40, 25), (40, 30), (0, 30)])
    put([notch, text(3, 10, "NOTCH", 4)], M + 3 * (48 + G), M)
    put([rect(0, 0, 50, 50), circle(25, 25, BUTTON_D_NEW, style=NO_KERF), text(3, 47, "BUTTON 30", 4)], M, M + 30 + G + 3)
    parts.append(text(M + 50 + G, M + 30 + G + 20, "Cut with the same settings as the real sheets.", 4))
    parts.append(text(M + 50 + G, M + 30 + G + 27, "A+B and TAB into NOTCH: firm by hand. Button: drops in, flange covers the hole.", 4))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="0 0 {w} {h}">\n'
           f'<!-- 3 mm MDF: joint + button-hole tests for sheets 10 and 11. Red = cut, green = cut (holes), blue = engrave -->\n'
           f'{rect(0, 0, w, h, style=MARK)}\n' + "\n".join(parts) + "\n</svg>\n")
    with open(os.path.join(HERE, "cabinet_12_tests_3mm.svg"), "w") as f:
        f.write(svg)


# ---------- the new front (2026-10-19) ----------
# The box was built as a mirror image of the drawings (every panel the other way
# round): printer column on the LEFT seen from the front, cassette on the RIGHT,
# bell grille in the left wall. The front and the doubler were then stolen, so
# they're cut again to fit the box as built. The cassette itself isn't mirrored
# (its motors still stick out of its right side), so in the right-hand column it
# sits against the divider with its motors towards the right wall — as in the
# maker's photo. The window is placed for that; the column leaves ~10 mm of play
# beside the motors, so push the cassette against the divider.
CAS_X_BUILT = X - DIV_X + 1          # cassette's left side: 1 mm right of the mirrored divider (216..218)
BUTTON_D_NEW = 30.0                  # 27.5 came out too small; 30 to be sure the buttons fit (the nut and flange cover it)
# The front's window frames only the cassette's own paper window (make_cassette.py:
# window 39.7–103.7 mm from the cassette's left side, 63–153 mm down from its top —
# matches the maker's photo within ~2 mm), so the light sensor, its tape and the
# marks stay hidden; WIN_INSET smaller on every side so a slightly-off cassette
# doesn't show the window's edges. (2026-10-19, on request; was the whole cassette front.)
CAS_WIN_X = (39.7, 103.7)
CAS_WIN_DOWN = (63.0, 153.0)
WIN_INSET = 2.0
NO_KERF = 'fill="none" stroke="#00a000" stroke-width="0.1"'   # green = cut with kerf offset OFF


# The button console (2026-10-19, the maker's choice: 20°, full width): a wedge
# glued to the bottom of the front, its sloping top tilted up towards the player
# with the two buttons in it. Side view (u = forward from the console's front
# edge, up = height):
#
#            sloped top (+ doubler under it, round the buttons)
#   CON_H_FRONT ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾│ CON_H_BACK
#              │ front strip   back wall│ ← glued flat against the box's front
#              └────────────────────────┘
#              ←──────── CON_D ────────→
# Two side pieces (plain, same shape — the second one is turned over) carry
# notches for tabs on the top, the front strip and the back wall; the back wall
# gives a big glue face against the front, and a cable hole through both takes
# the button wires into the bay. Open underneath: it stands on the table.
import math
CON_ANGLE = 20.0
CON_D = 80.0                          # how far it sticks out
CON_H_FRONT = 50.0                    # height of the sloped top's front edge
_tan, _cos, _sin = (f(math.radians(CON_ANGLE)) for f in (math.tan, math.cos, math.sin))
CON_H_BACK = CON_H_FRONT + CON_D * _tan
CON_W = X - 2 * T                     # top, strip and back wall sit between the two sides
CON_TOP_L = (CON_D - T * _sin) / _cos   # top's length along the slope: its square-cut back
                                        # end leans back, so its lower corner just meets the front
CON_TOP_TABS = (22.0, 62.0)           # along the slope from the front edge
CON_BUTTON_V = CON_TOP_L / 2          # buttons in the middle of the slope
CON_STRIP_H = CON_H_FRONT - T / _cos - 0.5          # front strip: just under the top
CON_WALL_H = CON_H_FRONT + (CON_D - T) * _tan - T / _cos - 0.5   # back wall: just under the top
CON_CABLE = (X / 2, 35.0, 40.0)       # cable hole through the back wall + front: x, height, diameter
CON_DOUBLER = (60.0, 14.0, 260.0, 56.0)   # x (box), v along the slope, w, length


def front_built():
    s = [poly(outline(X, Y, ("F", "F", "F", "F")))]
    x0, x1 = CAS_X_BUILT + CAS_WIN_X[0] + WIN_INSET, CAS_X_BUILT + CAS_WIN_X[1] - WIN_INSET
    top = CAS_SHELF + CAS_H - CAS_WIN_DOWN[0] - WIN_INSET            # window top, from the outer bottom
    h = CAS_WIN_DOWN[1] - CAS_WIN_DOWN[0] - 2 * WIN_INSET
    s.append(rect(x0, v_front(top), x1 - x0, h, style=NO_KERF, r=2))
    cx, cy, cd = CON_CABLE
    s.append(circle(cx, v_front(cy), cd, style=NO_KERF))
    s.append(rect(T, v_front(CON_WALL_H), CON_W, CON_WALL_H, style=MARK))   # where the console's back wall goes
    s.append(text(T + 6, v_front(CON_WALL_H) - 4, "button console here (glue its back wall on this box)", 5))
    s.append(text(T + 6, 14, "FRONT (for the mirrored build) — this face out."))
    s.append(text(x0, v_front(top) - 3, "window", 5))
    return s, X, Y, 0, 0


def console_side():
    """In side view, u forward from the front edge (left in the drawing), up = height."""
    def P(sv, depth=0.0):             # a point on the sloped edge, sv along it, depth into the piece
        return (sv * _cos + depth * _sin, CON_H_FRONT + sv * _sin - depth * _cos)
    pts = [(0, 0), (CON_D, 0)]
    wall_mid = CON_WALL_H / 2           # back-wall tab notch in the back edge
    pts += [(CON_D, wall_mid - TAB_L / 2), (CON_D - T, wall_mid - TAB_L / 2), (CON_D - T, wall_mid + TAB_L / 2), (CON_D, wall_mid + TAB_L / 2)]
    pts.append((CON_D, CON_H_BACK))
    for c in sorted(CON_TOP_TABS, reverse=True):      # top's tab notches, back to front
        pts += [P(c + TAB_L / 2), P(c + TAB_L / 2, T), P(c - TAB_L / 2, T), P(c - TAB_L / 2)]
    pts.append((0, CON_H_FRONT))
    strip_mid = CON_STRIP_H / 2
    pts += [(0, strip_mid + TAB_L / 2), (T, strip_mid + TAB_L / 2), (T, strip_mid - TAB_L / 2), (0, strip_mid - TAB_L / 2)]
    svg_pts = [(u, CON_H_BACK - up) for u, up in pts]
    return [poly(svg_pts)], CON_D, CON_H_BACK, 0, 0


def console_top():
    pts = tabbed(CON_W, CON_TOP_L, left=list(CON_TOP_TABS), right=list(CON_TOP_TABS))
    s = [poly(pts)]
    for bx in BUTTONS_X:
        s.append(circle(bx - T, CON_BUTTON_V, BUTTON_D_NEW, style=NO_KERF))
    return s, CON_W, CON_TOP_L, T, 0


def console_doubler():
    dx, dv, dw, dl = CON_DOUBLER
    s = [rect(0, 0, dw, dl)]
    for bx in BUTTONS_X:
        s.append(circle(bx - dx, CON_BUTTON_V - dv, BUTTON_D_NEW, style=NO_KERF))
    s.append(text(4, dl - 4, "DOUBLER — under the console top, holes lined up", 4))
    return s, dw, dl, 0, 0


def console_strip():
    return [poly(tabbed(CON_W, CON_STRIP_H, left=[CON_STRIP_H / 2], right=[CON_STRIP_H / 2]))], CON_W, CON_STRIP_H, T, 0


def console_wall():
    s = [poly(tabbed(CON_W, CON_WALL_H, left=[CON_WALL_H / 2], right=[CON_WALL_H / 2]))]
    cx, cy, cd = CON_CABLE
    s.append(circle(cx - T, CON_WALL_H - cy, cd, style=NO_KERF))
    return s, CON_W, CON_WALL_H, T, 0


def front_mirrored_sheet():
    assert CAS_X_BUILT + CAS_W + CAS_MOTORS < X - T - 2, "cassette + motors don't fit beside the divider"
    assert CON_TOP_TABS[-1] + TAB_L / 2 < CON_TOP_L - 3 and CON_TOP_TABS[0] - TAB_L / 2 > 3, "console top tabs off its ends"
    dx, dv, dw, dl = CON_DOUBLER
    assert dv > T / _sin * 0 + 8 and dv + dl < CON_TOP_L - 8, "doubler runs into the strip or the back wall"
    assert CON_CABLE[1] + CON_CABLE[2] / 2 < CON_WALL_H - 5, "cable hole too high for the back wall"
    sh = Sheet("cabinet_10_front_built_3mm.svg",
               "3 mm MDF: new front + console top + front strip, for the box as built (mirrored). Red = cut with kerf offset, green = kerf offset OFF")
    sh.add(front_built(), M, (SHEET_H - Y) / 2)
    x = M + X + G
    x, _ = sh.add(console_top(), x, M, rotate=True)
    sh.add(console_strip(), x + G, M, rotate=True)
    sh.write()
    sh = Sheet("cabinet_11_console_3mm.svg",
               "3 mm MDF: button console back wall + 2 sides + doubler. Red = cut with kerf offset, green = kerf offset OFF")
    _, y = sh.add(console_wall(), M, M)
    _, y2 = sh.add(console_doubler(), M, y + G)
    sh.add(console_side(), M + CON_W + 2 * T + G, M)
    sh.add(console_side(), M + CON_W + 2 * T + G, M + CON_H_BACK + G)
    sh.write()
    print(f"console: {CON_ANGLE:g}°, {CON_D:g} deep, {CON_H_FRONT:g} → {CON_H_BACK:.1f} high; top {CON_TOP_L:.1f} along the slope")


def button_recut():
    """One button hole on its own (2026-10-16), to cut again INTO the panels already
    cut: the kerf offset made the holes too small and they're hard to carve. Put
    the front (or the doubler) back in the laser, centre the head on an old hole
    and cut this circle there — once per hole, kerf offset OFF. The circle is
    in the middle of the page, so the job origin can be set to its centre."""
    d = BUTTON_D + 0.5          # a little room, since the old hole may sit slightly off
    w = d + 2 * M + 4
    c = w / 2
    parts = [circle(c, c, d)]   # nothing blue: it would be engraved onto the finished front
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{w}mm" viewBox="0 0 {w} {w}">\n'
           f'<!-- one {d:g} mm button hole, centred on the page; cut over each old hole with kerf offset OFF -->\n'
           + "\n".join(parts) + "\n</svg>\n")
    with open(os.path.join(HERE, "cabinet_9_button_hole_recut.svg"), "w") as f:
        f.write(svg)


def hex_recut():
    """A small extra file (2026-10-16): just the 4 hexagon squares of the corner
    blocks, to cut again. On sheet 2 the laser software's kerf offset shrank the
    hexagons so the M3 nuts didn't fit — cut this one with kerf offset OFF. The nut
    doesn't need a press fit (it's glued in between two round-hole squares), only
    not to turn, so the hexagon here is roomier (NUT_RECUT_AF)."""
    w, h = 4 * BLOCK + 3 * G + 2 * M, BLOCK + 2 * M + 8
    parts = []
    for i in range(4):
        x = M + i * (BLOCK + G)
        parts.append(rect(x, M, BLOCK, BLOCK))
        parts.append(hexagon(x + BLOCK / 2, M + BLOCK / 2, NUT_RECUT_AF))
    parts.append(text(M, M + BLOCK + 6, "4 NUT SQUARES - KERF OFFSET OFF", 4))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="0 0 {w} {h}">\n'
           f'<!-- 3 mm MDF: the 4 hexagon squares of the corner blocks again; cut with kerf offset OFF -->\n'
           f'{rect(0, 0, w, h, style=MARK)}\n' + "\n".join(parts) + "\n</svg>\n")
    with open(os.path.join(HERE, "cabinet_8_nut_squares_recut_3mm.svg"), "w") as f:
        f.write(svg)


if __name__ == "__main__":
    for s in build():
        print("wrote", s.name, "—", len(s.boxes), "parts")
    print(f"box outer {X:.0f} W × {Y:.0f} H × {Z + T:.0f} D mm; printer shelf at {SHELF_PR:.0f} mm, wedges {WEDGE:.0f} mm")
