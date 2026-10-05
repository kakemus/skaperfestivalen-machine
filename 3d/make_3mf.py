"""Packs STL parts into a .3mf print plate, so Bambu Studio opens them already
arranged (no rotating, no "add instance"). Pick the school's printer and PLA,
slice, print.

  python3 3d/make_3mf.py   →  3d/two_spools.3mf  (two spools side by side)
                              3d/fit_test.3mf    (the fit-test ring)
"""
import os
import struct
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))


def read_stl(path):
    data = open(path, "rb").read()
    n = struct.unpack("<I", data[80:84])[0]
    verts, index, tris = [], {}, []
    for i in range(n):
        off = 84 + i * 50 + 12
        tri = []
        for k in range(3):
            v = struct.unpack("<3f", data[off + k * 12: off + k * 12 + 12])
            if v not in index:
                index[v] = len(verts)
                verts.append(v)
            tri.append(index[v])
        tris.append(tri)
    return verts, tris


def model_xml(verts, tris, positions):
    vs = "".join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in verts)
    ts = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in tris)
    items = "".join(f'<item objectid="1" transform="1 0 0 0 1 0 0 0 1 {x} {y} 0"/>' for x, y in positions)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
            f'<resources><object id="1" type="model" name="spool"><mesh><vertices>{vs}</vertices>'
            f'<triangles>{ts}</triangles></mesh></object></resources><build>{items}</build></model>')


CONTENT_TYPES = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                 '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
                 '</Types>')
RELS = ('<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
        'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')


def write_3mf(stl, out, positions):
    verts, tris = read_stl(os.path.join(HERE, stl))
    with zipfile.ZipFile(os.path.join(HERE, out), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", RELS)
        z.writestr("3D/3dmodel.model", model_xml(verts, tris, positions))
    print(f"wrote {out}: {len(positions)} × {stl} ({len(tris)} triangles each)")


# Bambu plates are 256 mm (X1/P1) or 180 mm (A1 mini) square; the spools are 40 mm wide,
# so 25 mm apart around the plate centre fits every model.
write_3mf("spool.stl", "two_spools.3mf", [(103, 128), (153, 128)])
write_3mf("spool_fit_test.stl", "fit_test.3mf", [(128, 128)])
