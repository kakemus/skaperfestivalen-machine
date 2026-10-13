// The long printed strip that scrolls behind the backlit window — a scroll,
// not a loop: it starts wound on the bottom spool and is pulled up onto the
// top spool screen by screen (rewinding pulls it back down).
//
// Top to bottom: a leader (blank paper glued to the top spool's core and
// wound a few turns before anything shows in the window), screen 0
// (START), screens 1..levels, then a tail leader. The belt moves UP, so the
// next screen is the one printed BELOW the current one. Every screen carries a
// black registration mark at the left edge, level with the screen's middle —
// the light sensor sits there and the belt stops on its top edge. Screen 0
// gets a 3× longer "home" mark (same top edge) so the board can find START.
import { PRINT_WIDTH, DOTS_PER_MM, mmToDots } from "../core/raster.js";
import { font, fitSize } from "../tickets/draw.js";

export const DEFAULT_STRIP = {
  levels: 10,          // correct answers needed to win (screens 1..levels)
  screenMm: 100,       // height of one screen = how far the belt moves per step
  leaderMm: 200,       // blank paper at each end: glued to a spool core + a few turns + spool→window
  markMm: 8,           // registration mark height (home mark is 3x)
  markWidthMm: 10,
  titles: "START\nNIVÅ 1\nNIVÅ 2\nNIVÅ 3\nNIVÅ 4\nNIVÅ 5\nNIVÅ 6\nNIVÅ 7\nNIVÅ 8\nNIVÅ 9\nDU VANT!",
};

export function stripLayout(cfg) {
  const screen = mmToDots(cfg.screenMm), leader = mmToDots(cfg.leaderMm);
  const count = cfg.levels + 1;
  return {
    screen, leader, count,
    height: leader * 2 + screen * count,
    /** y (in dots) of the middle of screen i — where the window is centred when the belt is at i */
    centerOf: i => leader + screen * i + screen / 2,
  };
}

const SYMBOLS = ["★", "♥", "☾", "◆", "♣", "☀", "✦", "♠", "☂", "♪"];

export function drawStrip(cfg) {
  const L = stripLayout(cfg);
  const titles = String(cfg.titles).split("\n");
  const c = document.createElement("canvas");
  c.width = PRINT_WIDTH;
  c.height = L.height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const markW = mmToDots(cfg.markWidthMm), markH = mmToDots(cfg.markMm);
  const left = markW + 16, right = PRINT_WIDTH - 12, w = right - left, cx = (left + right) / 2;

  for (let i = 0; i < L.count; i++) {
    const top = L.leader + L.screen * i, mid = L.centerOf(i);
    const last = i === L.count - 1;
    // START = first title, the win screen = the LAST title (whatever the screen count),
    // levels in between take theirs from the list, or "NIVÅ n" once it runs out.
    const title = i === 0 ? titles[0] || "START"
      : last ? titles[titles.length - 1] || "DU VANT!"
      : i < titles.length - 1 ? titles[i] : `NIVÅ ${i}`;

    // registration mark (home mark = 3x as tall). The board stops on a mark's
    // TOP edge, so START's long mark starts where every other mark starts and
    // grows downwards — centred, START used to sit a few mm off the others.
    const h = i === 0 ? markH * 3 : markH;
    ctx.fillRect(0, mid - markH / 2, markW, h);

    // frame
    ctx.lineWidth = 4;
    ctx.strokeRect(left, top + 10, w, L.screen - 20);

    if (i === 0 || last) {
      // start / finish: big reversed band
      ctx.fillRect(left, mid - 70, w, 140);
      ctx.fillStyle = "#fff";
      fitSize(ctx, title, w - 30, 110, { weight: "900" });
      ctx.fillText(title, cx, mid);
      ctx.fillStyle = "#000";
      ctx.font = font(40);
      const deco = last ? "★ ★ ★ ★ ★" : "▲  ▲  ▲";
      ctx.fillText(deco, cx, top + 50);
      ctx.fillText(deco, cx, top + L.screen - 50);
    } else {
      // level: huge number, title, a row of symbols showing how far you've come
      ctx.font = font(Math.min(260, L.screen * 0.55), { weight: "900" });
      ctx.fillText(String(i), cx, mid - L.screen * 0.08);
      fitSize(ctx, title, w - 30, 56, { weight: "bold" });
      ctx.fillText(title, cx, top + L.screen - 70);
      ctx.font = font(30);
      ctx.fillText(SYMBOLS.slice(0, i).join(" ") || " ", cx, top + 46);
    }
  }

  // leaders: a "glue here" zone at the very ends, then arrows so whoever mounts
  // it knows which end is up and which spool it goes on
  const glue = Math.min(mmToDots(40), L.leader / 3);
  for (const [y0, spool] of [[0, "ØVERSTE SPOLE"], [L.height - glue, "NEDERSTE SPOLE"]]) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeRect(14, y0 + 8, PRINT_WIDTH - 28, glue - 16);
    ctx.restore();
    ctx.font = font(30, { weight: "900" });
    ctx.fillText("LIM HER", PRINT_WIDTH / 2, y0 + glue / 2 - 16);
    ctx.font = font(20);
    ctx.fillText(`→ ${spool}`, PRINT_WIDTH / 2, y0 + glue / 2 + 18);
  }
  ctx.font = font(28);
  for (const y of [(glue + L.leader) / 2, L.height - (glue + L.leader) / 2]) ctx.fillText("↑ OPP ↑", cx, y);
  return c;
}

export const stripLengthCm = cfg => stripLayout(cfg).height / DOTS_PER_MM / 10;
