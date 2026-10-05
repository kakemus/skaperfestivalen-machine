"""Builds spool.stl — the belt spool that pushes onto a yellow TT gear motor.

No 3D software needed: run `python3 3d/make_spool.py` after changing a number
below, and it rewrites 3d/spool.stl. (spool.scad is the same part for OpenSCAD.)

Shape: a solid of revolution. Two flanges keep the 80 mm paper running
straight (the top one flares out at 45° so it prints standing on the flat
flange with no supports); the hole is the TT motor's double-flat "D" shaft at the motor end
and a round M3 axle hole for the rest of the way (the far end turns on an M3
screw in a bracket). Tape the paper to the core.
"""
import math
import os
import struct

# ---- sizes in mm (change these, then re-run) ----
PAPER_GAP = 84.0        # space between the flanges: 80 mm paper + 4 mm play
CORE_D = 22.0           # what the paper winds onto
FLANGE_D = 40.0
FLANGE_T = 2.4
SHAFT_D = 5.5           # TT motor shaft: round part ≈ 5.4 mm …
SHAFT_FLATS = 3.8       # … flats ≈ 3.7 mm apart (+ a little print clearance)
SHAFT_DEPTH = 9.0       # how far the shaft goes in
AXLE_D = 3.3            # M3 screw as the axle at the far end
SEGMENTS = 128          # smoothness

CONE = (FLANGE_D - CORE_D) / 2   # top flange flares out at 45°, so it prints standing up without supports
L = FLANGE_T * 2 + PAPER_GAP + CONE


def d_hole(theta):
    """Radius of the D-shaped (double-flat) hole at angle theta."""
    c = abs(math.cos(theta))
    return min(SHAFT_D / 2, (SHAFT_FLATS / 2) / c) if c > 1e-9 else SHAFT_D / 2


def ring(z, radius):
    return [(radius(t) * math.cos(t), radius(t) * math.sin(t), z)
            for t in (2 * math.pi * i / SEGMENTS for i in range(SEGMENTS))]


const = lambda r: (lambda t: r)
# profiles as (z, radius-function), walked from z = 0 to z = L
outer = [(0, const(FLANGE_D / 2)), (FLANGE_T, const(FLANGE_D / 2)), (FLANGE_T, const(CORE_D / 2)),
         (FLANGE_T + PAPER_GAP, const(CORE_D / 2)), (L - FLANGE_T, const(FLANGE_D / 2)), (L, const(FLANGE_D / 2))]
inner = [(0, d_hole), (SHAFT_DEPTH, d_hole), (SHAFT_DEPTH, const(AXLE_D / 2)), (L, const(AXLE_D / 2))]

tris = []


def strip(a, b, flip=False):
    """Quads between two rings, as triangles."""
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        t1, t2 = (a[i], a[j], b[j]), (a[i], b[j], b[i])
        if flip:
            t1, t2 = t1[::-1], t2[::-1]
        tris.extend([t1, t2])


outer_rings = [ring(z, r) for z, r in outer]
inner_rings = [ring(z, r) for z, r in inner]
for a, b in zip(outer_rings, outer_rings[1:]):
    strip(a, b)
for a, b in zip(inner_rings, inner_rings[1:]):
    strip(a, b, flip=True)
strip(inner_rings[0], outer_rings[0])     # end cap at z = 0
strip(outer_rings[-1], inner_rings[-1])   # end cap at z = L


def normal(t):
    (ax, ay, az), (bx, by, bz), (cx, cy, cz) = t
    ux, uy, uz, vx, vy, vz = bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    m = math.sqrt(nx * nx + ny * ny + nz * nz) or 1
    return nx / m, ny / m, nz / m


# Make sure the normals point outwards (positive volume); flip everything if not.
volume = sum((a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
             for a, b, c in tris)
if volume < 0:
    tris = [t[::-1] for t in tris]
    volume = -volume

# Check it's watertight: every edge used exactly twice, once in each direction.
edges = {}
for a, b, c in tris:
    for e in ((a, b), (b, c), (c, a)):
        edges[e] = edges.get(e, 0) + 1
bad = sum(1 for (p, q), n in edges.items() if n != 1 or edges.get((q, p)) != 1)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spool.stl")
with open(out, "wb") as f:
    f.write(b"skaperfestivalen belt spool".ljust(80, b" "))
    f.write(struct.pack("<I", len(tris)))
    for t in tris:
        f.write(struct.pack("<3f", *normal(t)))
        for p in t:
            f.write(struct.pack("<3f", *p))
        f.write(b"\0\0")
print(f"wrote {out}: {len(tris)} triangles, {volume / 1000:.1f} cm³, length {L} mm, open edges: {bad}")
