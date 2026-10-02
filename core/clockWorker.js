// Runs core/clock.js's timers off the page, where Chrome doesn't throttle them.
const timers = new Map();
onmessage = ({ data: { id, ms, repeat, cancel } }) => {
  if (cancel) {
    clearTimeout(timers.get(id));
    clearInterval(timers.get(id));
    timers.delete(id);
    return;
  }
  timers.set(id, repeat
    ? setInterval(() => postMessage(id), ms)
    : setTimeout(() => { timers.delete(id); postMessage(id); }, ms));
};
