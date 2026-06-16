/**
 * @react-native-async-storage/async-storage is a native module (AsyncStorage on
 * iOS / SharedPreferences on Android). It has no web implementation and throws
 * "Cannot find native module 'RNCAsyncStorage'" at import on web. Generated app
 * onboarding code reads it unconditionally in useEffect on the home route, so
 * the unstubbed import crashes Metro export and renders only the noscript shell.
 *
 * Web shim: back the same async getItem/setItem/removeItem API by
 * window.localStorage so screens that persist onboarding state continue working
 * on the web preview. Falls back to in-memory storage if localStorage is gone
 * (SSR / prerender pass) so module-init never throws.
 */
const makeStub = require('../_stub');

const hasLocalStorage = (function () {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
})();

const memory = new Map();

function read(key) {
  if (hasLocalStorage) {
    try { return window.localStorage.getItem(key); } catch { /* fall through */ }
  }
  const v = memory.get(key);
  return v === undefined ? null : v;
}

function write(key, value) {
  if (hasLocalStorage) {
    try { window.localStorage.setItem(key, value); return; } catch { /* fall through */ }
  }
  memory.set(key, value);
}

function remove(key) {
  if (hasLocalStorage) {
    try { window.localStorage.removeItem(key); return; } catch { /* fall through */ }
  }
  memory.delete(key);
}

const AsyncStorage = makeStub({
  getItem: async (key) => read(key),
  setItem: async (key, value) => { write(key, String(value ?? '')); },
  removeItem: async (key) => { remove(key); },
  clear: async () => {
    if (hasLocalStorage) {
      try { window.localStorage.clear(); return; } catch { /* fall through */ }
    }
    memory.clear();
  },
  getAllKeys: async () => {
    if (hasLocalStorage) {
      try { return Object.keys(window.localStorage); } catch { /* fall through */ }
    }
    return Array.from(memory.keys());
  },
  multiGet: async (keys) => keys.map((k) => [k, read(k)]),
  multiSet: async (pairs) => { pairs.forEach(([k, v]) => write(k, String(v ?? ''))); },
  multiRemove: async (keys) => { keys.forEach((k) => remove(k)); },
  mergeItem: async (key, value) => { write(key, String(value ?? '')); },
});

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
module.exports.__esModule = true;
