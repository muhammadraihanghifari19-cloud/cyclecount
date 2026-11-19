/* Simpan hasil bacaan xlsx di browser (IndexedDB) supaya tidak perlu upload ulang.
   Data hanya tersimpan di komputer ini. Semua fungsi mengembalikan Promise dan tidak pernah melempar error:
   kalau IndexedDB tidak tersedia, hasilnya null/false. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CCStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const DB = 'cc-dashboard', STORE = 'kv', KEY = 'last';
  // Naikkan angka ini kalau bentuk data berubah, supaya cache lama diabaikan.
  const SCHEMA = 5;

  function open(idb) {
    return new Promise((resolve, reject) => {
      const req = idb.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function run(idb, mode, fn) {
    return open(idb).then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    }));
  }

  function getIdb(idb) {
    return idb || (typeof indexedDB !== 'undefined' ? indexedDB : null);
  }

  function save(data, idb) {
    const i = getIdb(idb);
    if (!i) return Promise.resolve(false);
    return run(i, 'readwrite', s => s.put(Object.assign({ schema: SCHEMA }, data), KEY)).then(() => true, () => false);
  }

  function load(idb) {
    const i = getIdb(idb);
    if (!i) return Promise.resolve(null);
    return run(i, 'readonly', s => s.get(KEY)).then(v => (v && v.schema === SCHEMA ? v : null), () => null);
  }

  function clear(idb) {
    const i = getIdb(idb);
    if (!i) return Promise.resolve(false);
    return run(i, 'readwrite', s => s.delete(KEY)).then(() => true, () => false);
  }

  return { SCHEMA, save, load, clear };
});
