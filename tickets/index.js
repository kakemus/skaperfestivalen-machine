// Every ticket design. A design is { label, fields, randomize?, draw(values, { feedMm }) }:
// the page builds its edit controls from `fields`, and `draw` returns the canvas
// that gets printed. Adding a design = one file + one line here.
import prize from "./prize.js";
import fortune from "./fortune.js";
import plain from "./plain.js";
import reward from "./reward.js";

export const TICKETS = { prize, fortune, plain, reward };
