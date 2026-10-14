// Web Serial, rebuilt on WebUSB — for browsers that have WebUSB but no Web
// Serial, like the old Android phone that may run the machine (Redmi Note 7,
// Chrome 87, which can't be updated; tested 2026-10-14 with phonecheck.html).
//
// The micro:bit's USB plug carries an ordinary USB serial port (CDC-ACM: a
// "communication" interface, class 2, plus a "data" interface, class 0x0A,
// with one bulk endpoint each way) — the same one a Mac uses as
// /dev/cu.usbmodem. Chrome lets WebUSB claim it. This module offers the small
// part of navigator.serial that core/controller.js uses — getPorts,
// requestPort, connect/disconnect events, and ports with open / readable /
// writable / close / getInfo — so controller.js works the same on both.

const ports = new Map();          // USBDevice -> its port, so events hand out the same object

class UsbSerialPort {
  constructor(device) {
    this.device = device;
    this.readable = null;
    this.writable = null;
  }

  getInfo() {
    return { usbVendorId: this.device.vendorId, usbProductId: this.device.productId };
  }

  async open({ baudRate = 115200 } = {}) {
    const d = this.device;
    await d.open();
    if (!d.configuration) await d.selectConfiguration(1);
    const ifaces = d.configuration.interfaces;
    const comm = ifaces.find(i => i.alternates[0].interfaceClass === 2);
    const data = ifaces.find(i => i.alternates[0].interfaceClass === 0x0a);
    if (!data) { await d.close(); throw new Error("This USB device has no serial port."); }
    if (comm) await d.claimInterface(comm.interfaceNumber);
    await d.claimInterface(data.interfaceNumber);
    const eps = data.alternates[0].endpoints;
    const inEp = eps.find(e => e.direction === "in");
    const outEp = eps.find(e => e.direction === "out");
    if (comm) {
      const setup = (request, value = 0) =>
        ({ requestType: "class", recipient: "interface", request, value, index: comm.interfaceNumber });
      const b = baudRate;
      await d.controlTransferOut(setup(0x20), new Uint8Array([b & 255, (b >> 8) & 255, (b >> 16) & 255, b >>> 24, 0, 0, 8])); // SET_LINE_CODING 8N1
      await d.controlTransferOut(setup(0x22, 0x03));                                                                              // DTR + RTS on
    }
    this.readable = new ReadableStream({
      async pull(controller) {
        try {
          for (;;) {
            const r = await d.transferIn(inEp.endpointNumber, inEp.packetSize || 64);
            if (r.status !== "ok") throw new Error("read " + r.status);
            if (r.data.byteLength) {
              controller.enqueue(new Uint8Array(r.data.buffer.slice(r.data.byteOffset, r.data.byteOffset + r.data.byteLength)));
              return;
            }
          }
        } catch (e) {
          controller.error(e);       // unplugged / closed: the reader ends, like Web Serial's
        }
      },
    });
    this.writable = new WritableStream({
      async write(chunk) {
        const r = await d.transferOut(outEp.endpointNumber, chunk);
        if (r.status !== "ok") throw new Error("write " + r.status);
      },
    });
  }

  async close() {
    this.readable = null;
    this.writable = null;
    try { await this.device.close(); } catch {}
  }
}

function portFor(device) {
  if (!ports.has(device)) ports.set(device, new UsbSerialPort(device));
  return ports.get(device);
}

// navigator.serial's filter { usbVendorId } → WebUSB's { vendorId }
const usbFilters = filters => (filters || []).map(f => ({ vendorId: f.usbVendorId, productId: f.usbProductId }))
  .map(f => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)));

export const usbSerial = {
  async getPorts() {
    return (await navigator.usb.getDevices()).map(portFor);
  },
  async requestPort({ filters } = {}) {
    return portFor(await navigator.usb.requestDevice({ filters: usbFilters(filters) }));
  },
  addEventListener(type, listener) {
    navigator.usb.addEventListener(type, e => listener({ port: portFor(e.device) }));
  },
};

/** navigator.serial where it exists, this WebUSB version where only WebUSB does, else null. */
export function serialApi() {
  if (typeof navigator === "undefined") return null;
  if ("serial" in navigator) return navigator.serial;
  if ("usb" in navigator) return usbSerial;
  return null;
}
