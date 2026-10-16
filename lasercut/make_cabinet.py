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
INSIDE — a divider wall (2 mm) at x 137–139 splits the upper part:
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

DIV_X = 137.0        # divider wall's left face, from the outer left (thickness T2)

# printer (right column)
PR_W, PR_D = 190.0, 140.0
PR_FRONT_H, PR_BACK_H = 125.0, 150.0
PR_X = 145.0         # its left side
PR_Z = 11.0          # its front, from the box's outer front (behind the top panel's front strip)
PR_TOP = Y - 1.0     # where its (levelled) top ends up: 1 mm under the top surface
MOUTH_X, MOUTH_W, MOUTH_D = 17.0, 100.0, 35.0          # from the printer's left; size
MOUTH_FROM_FRONT = 35.0   # mouth's front edge behind the printer's front (measured by the maker, 2026-10-16)
LEVER_W, LEVER_D = 45.0, 20.0
LEVER_FROM_RIGHT = 22.0                                  # lever's right end, from the printer's right
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

# ---------- derived ----------
IN_TOP = Y - T                        # inner top (underside of the top panel), from the bottom
SHELF_PR = PR_TOP - PR_BACK_H         # printer shelf top: the printer's back sits on it
WEDGE = PR_BACK_H - PR_FRONT_H        # front raised by this (25)
opening = (PR_X - 2, PR_Z - 2, PR_W + 4, PR_D + 4)   # top panel opening x, z, w, d — the printer rises into it
LID = (opening[0] - 15, 2.0, opening[2] + 30, 170.0) # lid x, z, w, d — overlaps the opening

assert CAS_SHELF + CAS_H < IN_TOP - 5, "cassette doesn't fit under the top"
assert CAS_X + CAS_W < DIV_X - 2 and CAS_X > T + 2, "cassette doesn't fit between the left wall and the divider"
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
    zones = [   # x, z, w, d, label — what stands where in the bay (engraved)
        (X - T - 45, 90, 45, 80, "BELL"),
        (150, 80, 75, 160, "PHONE"),
        (240, 200, 60, 40, "WUKONG"),
        (240, 150, 25, 35, "RELAY"),
        (280, 150, 25, 15, "9V"),
        (25, 100, 70, 140, "POWER BANK"),
    ]
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
    s.append(text(8, 14, "DIVIDER (2 mm) — front edge on the left", 6))
    s.append(text(8, IN_TOP - CAS_SHELF - 4, "cassette shelf on the LEFT face, printer shelf on the RIGHT", 4))
    return s, w, h, 0, T


def lid():
    lx, lz, lw, ld = LID
    s = [rect(0, 0, lw, ld, r=3)]
    mx0 = PR_X + MOUTH_X - CUT_MARGIN - lx
    mz0 = PR_Z + MOUTH_FROM_FRONT - CUT_MARGIN - lz
    s.append(rect(mx0, mz0, MOUTH_W + 2 * CUT_MARGIN, MOUTH_D + 2 * CUT_MARGIN, r=2))
    lever_x = PR_X + PR_W - LEVER_FROM_RIGHT - LEVER_W
    lever_cz = PR_Z + MOUTH_FROM_FRONT + MOUTH_D / 2
    s.append(rect(lever_x - CUT_MARGIN - lx, lever_cz - LEVER_D / 2 - CUT_MARGIN - lz,
                  LEVER_W + 2 * CUT_MARGIN, LEVER_D + 2 * CUT_MARGIN, r=2))
    s.append(circle(lw / 2, ld, 26))                               # finger notch at the back edge
    s.append(text(6, ld - 8, "LID — lies on the top; cleats underside drop into the opening", 4.5))
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
    return sheets


if __name__ == "__main__":
    for s in build():
        print("wrote", s.name, "—", len(s.boxes), "parts")
    print(f"box outer {X:.0f} W × {Y:.0f} H × {Z + T:.0f} D mm; printer shelf at {SHELF_PR:.0f} mm, wedges {WEDGE:.0f} mm")
