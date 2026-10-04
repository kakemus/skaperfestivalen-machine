// Only one open copy of the page may drive the hardware.
//
// Two tabs both running the machine wrote to the IBM display at once — the
// screen turned to garbage and writes kept failing (2026-10-04). A Web Lock
// held for the page's whole life makes the first tab "in charge"; any other
// tab waits, and takes over by itself if the first one is closed.
let charge = false;
/** True once this tab holds the lock. Device modules refuse to connect until then. */
export const inCharge = () => charge;

export function whenInCharge(onInCharge, onWaiting) {
  const take = () => { charge = true; onInCharge(); return new Promise(() => {}); }; // held until the tab closes
  if (!navigator.locks) { take(); return; } // very old browser: just run
  navigator.locks.request("machine-hardware", { ifAvailable: true }, lock => {
    if (lock) return take();
    onWaiting();
    // queue up: granted the moment the other tab goes away
    navigator.locks.request("machine-hardware", take);
  });
}
