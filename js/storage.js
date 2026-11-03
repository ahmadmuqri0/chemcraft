/**
 * storage.js
 * Tiny, crash-proof wrapper around localStorage.
 *
 * localStorage can throw (private windows, blocked site data, sandboxed iframes),
 * so every read and write is guarded and the game keeps working without it.
 */

const PREFIX = 'chemcraft.';

/** Reads a JSON value, or returns `fallback` when missing or unreadable. */
export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Writes a JSON value. Silently ignores storage failures. */
export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: progress simply is not remembered */
  }
}

/** Removes a stored value. */
export function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
