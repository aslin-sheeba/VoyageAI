/**
 * socketManager.js
 * Singleton pattern so any controller can call getIO() without circular imports.
 */
let _io = null;

export function setIO(io) {
  _io = io;
}

export function getIO() {
  return _io;
}
