// Minimal pub/sub. Behaviors never call each other directly — they only
// react to shared signals and emit requests through here. That's what lets
// you add or remove a behavior without rewiring anything else.

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach(handler => {
    try {
      handler(payload);
    } catch (e) {
      console.error(`[eventBus] handler for "${event}" threw:`, e);
    }
  });
}
