// Belt spool for a yellow TT gear motor — the same part as spool.stl
// (which make_spool.py builds without needing OpenSCAD). Print two.
// The paper is taped to the core; the far end turns on an M3 screw.
paper_gap   = 84;    // between the flanges: 80 mm paper + play
core_d      = 22;
flange_d    = 40;
flange_t    = 2.4;
shaft_d     = 5.5;   // TT motor shaft ≈ 5.4 mm round …
shaft_flats = 3.8;   // … with flats ≈ 3.7 mm apart (+ print clearance)
shaft_depth = 9;
axle_d      = 3.3;   // M3 screw as the far-end axle
$fn = 128;

cone = (flange_d - core_d) / 2;  // 45° top flange: prints standing up, no supports
L = paper_gap + 2 * flange_t + cone;

difference() {
  union() {
    cylinder(d = flange_d, h = flange_t);
    cylinder(d = core_d, h = L);
    translate([0, 0, flange_t + paper_gap]) cylinder(d1 = core_d, d2 = flange_d, h = cone);
    translate([0, 0, L - flange_t]) cylinder(d = flange_d, h = flange_t);
  }
  // D-shaped motor shaft hole
  translate([0, 0, -0.01]) intersection() {
    cylinder(d = shaft_d, h = shaft_depth + 0.01);
    translate([-shaft_flats / 2, -shaft_d, 0]) cube([shaft_flats, 2 * shaft_d, shaft_depth + 0.01]);
  }
  // axle hole for the rest of the way
  translate([0, 0, -0.01]) cylinder(d = axle_d, h = L + 0.02);
}
