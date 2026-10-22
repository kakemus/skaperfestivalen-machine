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

// A screen can instead carry its own content (cfg.screens[i], e.g. Kvitteringsspillet's
// questions, game/kvitteringTegning.js): { head, box, price, lines, answers, foot } —
// all optional strings (lines: an array; image: a ready canvas, instead of the box), laid out inside the part of the screen
// that shows through the window (screens/README.md: 63 × 90 mm from 72, 40 px; the
// cabinet's front window is 2 mm smaller again, so a little margin inside that).
// Measured on the built machine (2026-10-20, the maker's photo): the front's window sits
// ~5 mm left of where it was drawn, so about 5–65 mm of the paper's width shows (the mark's
// right half too) and text past ~65 mm was cut off. Content now 12–62 mm: clear of the mark,
// 3 mm inside the right edge.
const WIN = { x: 96, y: 60, w: 400, h: 680 };

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

    if (cfg.screens && cfg.screens[i]) {
      drawScreen(ctx, cfg.screens[i], top);
      continue;
    }

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

/** One screen with its own content (see WIN above), top to bottom: a small head line,
 *  a framed box (a picture's stand-in), its price, the question in big letters, the
 *  answers, and a small foot line. The question is set as big as fits what's left. */
function drawScreen(ctx, sc, top) {
  const x0 = WIN.x, w = WIN.w, cx = x0 + w / 2;
  let y = top + WIN.y, bottom = top + WIN.y + WIN.h;
  ctx.textBaseline = "top";
  const line = (text, size, opts) => { fitSize(ctx, text, w, size, opts); ctx.fillText(text, cx, y); y += Math.round(size * 1.2); };
  // the head ("1 / 10"): the window is seen a little from above, so its top edge hides
  // the first few mm — set lower and bigger (2026-10-22, the maker's photo)
  if (sc.head) { y += 22; line(sc.head, 38, { weight: "900" }); y += 6; }
  if (sc.foot) {
    fitSize(ctx, sc.foot, w, 24, { weight: "normal" });
    ctx.fillText(sc.foot, cx, bottom - 26);
    bottom -= 40;
  }
  if (Array.isArray(sc.answers)) {
    // [JA, NEI] side by side, like the buttons: JA white with black letters (a frame round
    // it), NEI black with white letters (2026-10-22)
    const two = sc.answers.some(a => a.includes("\n")), bw = (w - 16) / 2, bh = two ? 104 : 74, by = bottom - bh;
    ctx.lineWidth = 6;
    ctx.strokeRect(x0 + 3, by + 3, bw - 6, bh - 6);
    ctx.fillRect(x0 + bw + 16, by, bw, bh);
    // "JA\nVENNER": the button's word big, what it means smaller under it
    const label = (text, bx, color) => {
      const [a, b] = text.split("\n");
      ctx.fillStyle = color;
      const size = fitSize(ctx, a, bw - 20, 46, { weight: "900" });
      if (!b) return ctx.fillText(a, bx + bw / 2, by + bh / 2 - size / 2);
      ctx.fillText(a, bx + bw / 2, by + 10);
      fitSize(ctx, b, bw - 20, 34, { weight: "900" });
      ctx.fillText(b, bx + bw / 2, by + 58);
    };
    label(sc.answers[0], x0, "#000");
    label(sc.answers[1], x0 + bw + 16, "#fff");
    ctx.fillStyle = "#000";
    bottom -= bh + 16;
  } else if (sc.answers) {
    ctx.fillRect(x0, bottom - 74, w, 74);              // the answers, reversed out of a black band
    ctx.fillStyle = "#fff";
    fitSize(ctx, sc.answers, w - 24, 46, { weight: "900" });
    ctx.fillText(sc.answers, cx, bottom - 37 - 23);
    ctx.fillStyle = "#000";
    bottom -= 90;
  }
  if (sc.image) {                                    // a ready black-and-white picture (game/kvitteringTegning.js)
    ctx.drawImage(sc.image, x0 + (w - sc.image.width) / 2, y);
    y += sc.image.height + 10;
  } else if (sc.box) {
    const bh = 210;
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 + 40, y, w - 80, bh);
    const words = wrapLines(ctx, `[ ${sc.box} ]`, w - 110, 34);
    const lh = 40, y0 = y + bh / 2 - words.length * lh / 2;
    words.forEach((l, k) => ctx.fillText(l, cx, y0 + k * lh));
    y += bh + 12;
  }
  if (sc.price) line(sc.price, 52, { weight: "900" });
  // the question: largest size at which all of it fits between y and bottom
  const text = (sc.lines || []).join("\n");
  let size = 64, wrapped;
  for (;;) {
    wrapped = text.split("\n").flatMap(p => wrapBalanced(ctx, p, w, size));
    if (size <= 20 || wrapped.length * size * 1.18 <= bottom - y - 10) break;
    size -= 2;
  }
  const lh = Math.round(size * 1.18);
  let ty = y + (bottom - y - wrapped.length * lh) / 2;
  ctx.font = font(size, { weight: "bold" });
  for (const l of wrapped) { ctx.fillText(l, cx, ty); ty += lh; }
  ctx.textBaseline = "middle";
}

/** Like wrapLines, but the lines as even as they can be in the same number of lines: no
 *  lone last word ("Livet er mange / valg." → "Livet er / mange valg."). The narrowest width
 *  that still gives as few lines is found by halving. */
function wrapBalanced(ctx, text, width, size) {
  const lines = wrapLines(ctx, text, width, size);
  if (lines.length < 2) return lines;
  let lo = 1, hi = width;
  while (hi - lo > 2) {
    const mid = (lo + hi) / 2;
    if (wrapLines(ctx, text, mid, size).length <= lines.length && wrapLines(ctx, text, mid, size).every(l => ctx.measureText(l).width <= mid)) hi = mid; else lo = mid;
  }
  return wrapLines(ctx, text, hi, size);
}

function wrapLines(ctx, text, width, size, weight = "bold") {
  ctx.font = font(size, { weight });
  const out = [];
  let cur = "";
  for (const word of String(text).split(" ")) {
    const next = cur ? cur + " " + word : word;
    if (cur && ctx.measureText(next).width > width) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export const stripLengthCm = cfg => stripLayout(cfg).height / DOTS_PER_MM / 10;
