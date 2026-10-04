// The long printed strip that runs as a belt behind the backlit window.
//
// Top to bottom: a leader (blank paper to wind onto the spool), screen 0
// (START), screens 1..levels, then a tail leader. The belt moves UP, so the
// next screen is the one printed BELOW the current one. Every screen carries a
// black registration mark at the left edge, level with the screen's middle —
// the light sensor sits there and the belt stops when it sees a mark. Screen 0
// gets a longer "home" mark so the belt can tell the start from the rest.
import { PRINT_WIDTH, DOTS_PER_MM, mmToDots } from "../core/raster.js";
import { font, fitSize } from "../tickets/draw.js";

export const DEFAULT_STRIP = {
  levels: 10,          // correct answers needed to win (screens 1..levels)
  screenMm: 100,       // height of one screen = how far the belt moves per step
  leaderMm: 80,        // blank paper before the first and after the last screen
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

    // registration mark (home mark = 3x as tall)
    const h = i === 0 ? markH * 3 : markH;
    ctx.fillRect(0, mid - h / 2, markW, h);

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

  // leaders: a thin centre line + "↑" so whoever mounts it knows which way is up
  ctx.font = font(28);
  ctx.fillText("↑ OPP ↑", cx, L.leader / 2);
  ctx.fillText("↑ OPP ↑", cx, L.height - L.leader / 2);
  return c;
}

export const stripLengthCm = cfg => stripLayout(cfg).height / DOTS_PER_MM / 10;
