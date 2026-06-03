// Almacenamiento local con IndexedDB (offline, sin servidor)
const DB_NAME = "wo_daily_hours";
const STORE = "projects";
const SETTINGS = "settings";

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS))
        db.createObjectStore(SETTINGS, { keyPath: "key" });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return open().then((db) => db.transaction(store, mode).objectStore(store));
}

export async function allProjects() {
  const st = await tx(STORE, "readonly");
  return new Promise((res, rej) => {
    const r = st.getAll();
    r.onsuccess = () => res(r.result.sort((a, b) => b.createdAt - a.createdAt));
    r.onerror = () => rej(r.error);
  });
}

export async function getProject(id) {
  const st = await tx(STORE, "readonly");
  return new Promise((res, rej) => {
    const r = st.get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveProject(p) {
  const st = await tx(STORE, "readwrite");
  return new Promise((res, rej) => {
    const r = st.put(p);
    r.onsuccess = () => res(p);
    r.onerror = () => rej(r.error);
  });
}

export async function deleteProject(id) {
  const st = await tx(STORE, "readwrite");
  return new Promise((res, rej) => {
    const r = st.delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export async function getSetting(key, def = null) {
  const st = await tx(SETTINGS, "readonly");
  return new Promise((res) => {
    const r = st.get(key);
    r.onsuccess = () => res(r.result ? r.result.value : def);
    r.onerror = () => res(def);
  });
}

export async function setSetting(key, value) {
  const st = await tx(SETTINGS, "readwrite");
  return new Promise((res, rej) => {
    const r = st.put({ key, value });
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
