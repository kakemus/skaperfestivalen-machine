// Timers that keep running when the page is in the background.
//
// Chrome slows ordinary setInterval/setTimeout in a hidden tab, and after ~5
// minutes hidden it only lets them fire once a minute — the display froze
// mid-animation and just hopped between scenes (seen 2026-10-02). Timers
// inside a Worker aren't throttled like that, so the worker keeps time and
// pokes the page. Use these for anything the machine does on its own.
const worker = new Worker(new URL("./clockWorker.js", import.meta.url));
const callbacks = new Map();
let nextId = 1;

worker.onmessage = ({ data: id }) => {
  const entry = callbacks.get(id);
  if (!entry) return;
  if (!entry.repeat) callbacks.delete(id);
  entry.fn();
};

export function every(ms, fn) {
  const id = nextId++;
  callbacks.set(id, { fn, repeat: true });
  worker.postMessage({ id, ms, repeat: true });
  return id;
}

export function after(ms, fn) {
  const id = nextId++;
  callbacks.set(id, { fn, repeat: false });
  worker.postMessage({ id, ms, repeat: false });
  return id;
}

export function cancel(id) {
  callbacks.delete(id);
  worker.postMessage({ id, cancel: true });
}
