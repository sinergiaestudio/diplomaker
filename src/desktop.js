(function bootDiplomakerDesktopBridge() {
  'use strict';

  const DM = window.Diplomaker = window.Diplomaker || {};
  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) return;
  if (!DM.Storage || !DM.Utils) {
    setTimeout(bootDiplomakerDesktopBridge, 20);
    return;
  }
  if (DM.Desktop) return;

  const invoke = tauri.core.invoke;
  const Storage = DM.Storage;
  const original = {
    saveProject: Storage.saveProject.bind(Storage),
    restoreProject: Storage.restoreProject?.bind(Storage),
    loadLastProject: Storage.loadLastProject.bind(Storage),
    listProjects: Storage.listProjects.bind(Storage),
    deleteProject: Storage.deleteProject?.bind(Storage)
  };

  document.documentElement.dataset.runtime = 'desktop';

  function portablePayload(project) {
    return JSON.stringify({
      format: 'diplomaker-project',
      version: '2.2.0',
      exportedAt: new Date().toISOString(),
      project
    }, null, 2);
  }

  async function importSnapshotsFromDisk() {
    try {
      const snapshots = await invoke('load_project_snapshots');
      const restore = original.restoreProject || original.saveProject;
      for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
        try {
          const parsed = JSON.parse(snapshot.contents);
          const project = parsed.project || parsed;
          if (project?.id && Array.isArray(project.records)) await restore(project);
        } catch (error) {
          console.warn(`No se pudo importar ${snapshot.fileName || 'un proyecto'} desde disco.`, error);
        }
      }
      return snapshots?.length || 0;
    } catch (error) {
      console.warn('No se pudieron sincronizar los proyectos de escritorio.', error);
      return 0;
    }
  }

  const ready = importSnapshotsFromDisk();

  Storage.loadLastProject = async function loadLastProjectDesktop() {
    await ready;
    const selected = await original.loadLastProject();
    if (selected) return selected;
    const projects = await original.listProjects();
    return projects[0] || null;
  };

  Storage.listProjects = async function listProjectsDesktop() {
    await ready;
    return original.listProjects();
  };

  Storage.saveProject = async function saveProjectDesktop(project) {
    const snapshot = await original.saveProject(project);
    try {
      await invoke('sync_project_file', {
        projectId: snapshot.id,
        projectName: snapshot.name || 'Proyecto Diplomaker',
        contents: portablePayload(snapshot)
      });
    } catch (error) {
      console.warn('El proyecto quedó guardado en la aplicación, pero no pudo escribirse en Documentos.', error);
    }
    return snapshot;
  };

  if (original.deleteProject) {
    Storage.deleteProject = async function deleteProjectDesktop(id) {
      await original.deleteProject(id);
      try { await invoke('delete_project_snapshot', { projectId: id }); }
      catch (error) { console.warn('No se pudo eliminar la copia local del proyecto.', error); }
    };
  }

  async function projectsDirectory() {
    return invoke('projects_directory');
  }

  function updateDesktopUI() {
    const badge = document.querySelector('.offline-badge');
    if (badge) badge.innerHTML = '<span></span> Escritorio · archivos locales';
    const installButton = document.getElementById('installExperienceButton');
    if (installButton) installButton.hidden = true;
    document.querySelectorAll('[data-mobile-install]').forEach(button => { button.style.display = 'none'; });

    const storageText = document.getElementById('storagePersistenceText');
    const storageButton = document.getElementById('requestPersistenceButton');
    if (storageText) storageText.textContent = 'Los proyectos se replican automáticamente en Documentos/Diplomaker/Proyectos.';
    if (storageButton) {
      storageButton.disabled = true;
      storageButton.textContent = 'Archivos locales activos';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateDesktopUI, { once: true });
  else updateDesktopUI();
  setTimeout(updateDesktopUI, 500);

  DM.Desktop = {
    ready,
    projectsDirectory,
    runtime: 'tauri'
  };
})();
