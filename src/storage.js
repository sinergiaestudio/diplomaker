(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};
  const U = DM.Utils;
  const DB_NAME = 'diplomaker2';
  const DB_VERSION = 1;
  const STORE = 'projects';
  const LAST_KEY = 'diplomaker2:lastProjectId';

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local.'));
    });
  }

  async function withStore(mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try { result = callback(store); } catch (error) { db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('Falló el almacenamiento local.')); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('La operación de almacenamiento fue cancelada.')); };
    });
  }

  async function saveProject(project) {
    const snapshot = U.deepClone(project);
    snapshot.updatedAt = new Date().toISOString();
    if (!snapshot.createdAt) snapshot.createdAt = snapshot.updatedAt;
    if (!snapshot.version || /^2\.[01]/.test(snapshot.version)) snapshot.version = '2.2.0';
    await withStore('readwrite', store => store.put(snapshot));
    localStorage.setItem(LAST_KEY, snapshot.id);
    return snapshot;
  }

  async function loadProject(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(id);
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }

  async function loadLastProject() {
    const id = localStorage.getItem(LAST_KEY);
    if (!id) return null;
    return loadProject(id);
  }

  async function listProjects() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => {
        db.close();
        resolve((request.result || []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
      };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }

  async function deleteProject(id) {
    if (!id) return;
    await withStore('readwrite', store => store.delete(id));
    if (localStorage.getItem(LAST_KEY) === id) localStorage.removeItem(LAST_KEY);
  }

  function exportProject(project) {
    const payload = {
      format: 'diplomaker-project',
      version: '2.2.0',
      exportedAt: new Date().toISOString(),
      project: U.deepClone(project)
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  async function importProject(file) {
    const raw = await U.readAsText(file);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { throw new Error('El archivo de proyecto no contiene JSON válido.'); }
    const project = parsed.project || parsed;
    if (!project || !Array.isArray(project.records)) throw new Error('El archivo no corresponde a un proyecto Diplomaker compatible.');
    if (!project.id) project.id = U.uuid('project');
    if (!project.name) project.name = 'Proyecto importado';
    return project;
  }

  DM.Storage = { saveProject, loadProject, loadLastProject, listProjects, deleteProject, exportProject, importProject };
})();
