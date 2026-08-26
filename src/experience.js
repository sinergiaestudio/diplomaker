(function bootDiplomakerExperience() {
  'use strict';

  const APP_VERSION = '2.2.0-alpha.2';
  const APP_LABEL = '2.2 · Identidad y proyectos';
  const THEME_KEY = 'diplomaker:theme';
  const UPDATE_DISMISSED_KEY = 'diplomaker:update-dismissed';
  const REPOSITORY_URL = 'https://github.com/sinergiaestudio/diplomaker';
  const AUTHOR_URL = 'https://github.com/sinergiaestudio';
  const WEB_URL = 'https://sinergiaestudio.github.io/diplomaker/';

  const DM = window.Diplomaker = window.Diplomaker || {};
  if (!DM.Utils || !DM.Storage || !DM.TemplateLibrary || document.readyState === 'loading') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootDiplomakerExperience, { once: true });
    } else {
      setTimeout(bootDiplomakerExperience, 25);
    }
    return;
  }
  if (DM.Experience) return;

  const U = DM.Utils;
  const Storage = DM.Storage;
  const TL = DM.TemplateLibrary;
  let installPrompt = null;
  let currentThemePreference = 'light';
  let reloadingForUpdate = false;

  const $ = id => document.getElementById(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function toast(message, type = '') {
    const region = $('toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    region.appendChild(node);
    setTimeout(() => node.remove(), 3900);
  }

  function standaloneMode() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function preferredSystemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function normalizedThemePreference(value) {
    return ['light', 'dark', 'system'].includes(value) ? value : 'light';
  }

  function updateThemeColor(theme) {
    let meta = q('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === 'dark' ? '#0c1724' : '#f5f7fa';
  }

  function themeIcon(preference) {
    if (preference === 'dark') return '☾';
    if (preference === 'system') return '◐';
    return '☀';
  }

  function themeName(preference) {
    if (preference === 'dark') return 'Oscuro';
    if (preference === 'system') return 'Automático';
    return 'Claro';
  }

  function applyTheme(preference, persist = true) {
    currentThemePreference = normalizedThemePreference(preference);
    const resolved = currentThemePreference === 'system' ? preferredSystemTheme() : currentThemePreference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = currentThemePreference;
    if (persist) localStorage.setItem(THEME_KEY, currentThemePreference);
    updateThemeColor(resolved);
    qa('[data-theme-indicator]').forEach(node => {
      node.textContent = themeIcon(currentThemePreference);
      node.setAttribute('aria-label', `Tema: ${themeName(currentThemePreference)}. Cambiar apariencia.`);
      node.title = `Tema ${themeName(currentThemePreference).toLowerCase()}`;
    });
    qa('[data-theme-label]').forEach(node => { node.textContent = themeName(currentThemePreference); });
  }

  function cycleTheme() {
    const order = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(currentThemePreference) + 1) % order.length];
    applyTheme(next);
    toast(`Apariencia: ${themeName(next)}.`, 'success');
  }

  function injectBranding() {
    const mark = q('.brand-mark');
    if (mark) {
      mark.innerHTML = '<img src="assets/brand/diplomaker-symbol.svg" alt="">';
      mark.setAttribute('aria-hidden', 'true');
    }
    const brandName = q('.brand-name');
    if (brandName) brandName.textContent = 'Diplomaker';
    const version = q('.brand-version');
    if (version) version.textContent = APP_LABEL;
    const brandText = q('.brand > div:last-child');
    if (brandText && !q('.brand-tagline', brandText)) {
      const tagline = document.createElement('div');
      tagline.className = 'brand-tagline';
      tagline.textContent = 'Diseñá una vez. Emití con precisión.';
      brandText.appendChild(tagline);
    }

    document.title = 'Diplomaker — Diseñá una vez. Emití con precisión.';
    const heroKicker = q('.hero-kicker');
    const heroTitle = q('.hero-copy h2');
    const heroText = q('.hero-copy p');
    if (heroKicker) heroKicker.textContent = 'ESTUDIO LOCAL DE DIPLOMAS Y CERTIFICADOS';
    if (heroTitle) heroTitle.textContent = 'Diseñá una vez. Emití con precisión.';
    if (heroText) heroText.textContent = 'Creá una plantilla, cargá una persona o una planilla y emití certificados individuales o lotes completos. Tus plantillas. Tus datos. Tus certificados.';

    const title = $('viewTitle');
    if (title && title.textContent.includes('Creador de')) title.textContent = 'Estudio de diplomas y certificados';

    const helpMeta = q('#helpDialog .muted-text');
    if (helpMeta) helpMeta.innerHTML = `Diplomaker ${APP_VERSION} · Creado por <a href="${AUTHOR_URL}" target="_blank" rel="noopener">Marcelo Gómez</a>`;

    const sidebarBottom = q('.sidebar-bottom');
    if (sidebarBottom && !q('.experience-author', sidebarBottom)) {
      const author = document.createElement('div');
      author.className = 'experience-author';
      author.innerHTML = `
        <div class="experience-author-version"><span>Diplomaker ${APP_VERSION}</span><span>MIT</span></div>
        <a href="${AUTHOR_URL}" target="_blank" rel="noopener">Creado por Marcelo Gómez ↗</a>
      `;
      sidebarBottom.appendChild(author);
    }

    const actionGrid = q('#view-home .action-grid');
    if (actionGrid && !q('[data-experience-projects]', actionGrid)) {
      const card = document.createElement('button');
      card.className = 'action-card';
      card.dataset.experienceProjects = 'true';
      card.innerHTML = '<span class="action-icon">▣</span><strong>Abrir un proyecto</strong><small>Recuperá trabajos guardados, creá copias y administrá respaldos.</small>';
      card.addEventListener('click', openProjectLibrary);
      actionGrid.appendChild(card);
    }
  }

  function injectTopbarActions() {
    const actions = q('.topbar-actions');
    if (!actions || q('[data-experience-controls]', actions)) return;
    const controls = document.createElement('div');
    controls.dataset.experienceControls = 'true';
    controls.style.display = 'contents';
    controls.innerHTML = `
      <button class="experience-button" id="projectsExperienceButton" type="button">
        <span class="experience-icon">▣</span><span class="experience-label">Proyectos</span>
      </button>
      <button class="experience-button primary" id="installExperienceButton" type="button" hidden>
        <span class="experience-icon">⇩</span><span class="experience-label">Instalar</span>
      </button>
      <button class="experience-button theme-mobile-trigger" id="themeExperienceButton" type="button" data-theme-indicator>
        ☀
      </button>
      <button class="experience-button" id="aboutExperienceButton" type="button">
        <span class="experience-icon">ⓘ</span><span class="experience-label">Acerca de</span>
      </button>
    `;
    const help = $('helpButton');
    actions.insertBefore(controls, help || null);
    $('projectsExperienceButton')?.addEventListener('click', openProjectLibrary);
    $('installExperienceButton')?.addEventListener('click', triggerInstall);
    $('themeExperienceButton')?.addEventListener('click', cycleTheme);
    $('aboutExperienceButton')?.addEventListener('click', () => $('aboutExperienceDialog')?.showModal());
  }

  function createDialogs() {
    if (!$('projectLibraryDialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'projectLibraryDialog';
      dialog.className = 'experience-dialog';
      dialog.innerHTML = `
        <div class="experience-dialog-head">
          <div><div class="eyebrow">CONTINUIDAD</div><h2>Biblioteca de proyectos</h2><p>Trabajos guardados en este dispositivo y copias portables.</p></div>
          <button class="icon-button" type="button" data-experience-close>×</button>
        </div>
        <div class="experience-dialog-body">
          <div class="project-toolbar">
            <button class="primary-button" type="button" id="newLibraryProjectButton">＋ Nuevo proyecto</button>
            <button class="secondary-button" type="button" id="openPortableLibraryButton">Abrir archivo .diplomaker</button>
            <button class="ghost-button" type="button" id="backupAllProjectsButton">Respaldar todos</button>
            <button class="ghost-button" type="button" id="restoreProjectsButton">Restaurar respaldo</button>
            <input type="file" id="restoreProjectsInput" accept=".zip,application/zip" hidden>
          </div>
          <div class="project-storage-card" id="storagePersistenceCard">
            <div><strong>Protección del almacenamiento local</strong><small id="storagePersistenceText">Comprobando el estado del dispositivo…</small></div>
            <button class="secondary-button small" type="button" id="requestPersistenceButton">Proteger almacenamiento</button>
          </div>
          <div class="project-list" id="projectLibraryList"></div>
        </div>
      `;
      document.body.appendChild(dialog);
      q('[data-experience-close]', dialog)?.addEventListener('click', () => dialog.close());
      $('newLibraryProjectButton')?.addEventListener('click', createBlankProject);
      $('openPortableLibraryButton')?.addEventListener('click', () => $('projectFileInput')?.click());
      $('backupAllProjectsButton')?.addEventListener('click', backupAllProjects);
      $('restoreProjectsButton')?.addEventListener('click', () => $('restoreProjectsInput')?.click());
      $('restoreProjectsInput')?.addEventListener('change', event => restoreProjectsBackup(event.target.files?.[0]));
      $('requestPersistenceButton')?.addEventListener('click', requestPersistentStorage);
      dialog.addEventListener('close', () => { $('restoreProjectsInput').value = ''; });
    }

    if (!$('aboutExperienceDialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'aboutExperienceDialog';
      dialog.className = 'experience-dialog';
      dialog.innerHTML = `
        <div class="experience-dialog-head">
          <div><div class="eyebrow">ACERCA DE</div><h2>Diplomaker</h2><p>Identidad, alcance y condiciones de uso.</p></div>
          <button class="icon-button" type="button" data-experience-close>×</button>
        </div>
        <div class="experience-dialog-body">
          <div class="about-brand">
            <img src="assets/brand/diplomaker-symbol.svg" alt="Símbolo de Diplomaker">
            <div><h2>Diplomaker</h2><p>Estudio local de diplomas y certificados · ${APP_VERSION}</p></div>
          </div>
          <div class="about-slogan">Diseñá una vez. Emití con precisión.</div>
          <p>Diplomaker permite diseñar plantillas reutilizables, importar datos y emitir certificados sin enviar planillas, firmas, logos ni proyectos a un servidor.</p>
          <p><strong>Creado por <a href="${AUTHOR_URL}" target="_blank" rel="noopener">Marcelo Gómez</a>.</strong> Código abierto bajo licencia MIT.</p>
          <div class="about-links">
            <a class="secondary-button" href="${REPOSITORY_URL}" target="_blank" rel="noopener">Repositorio</a>
            <a class="ghost-button" href="${REPOSITORY_URL}/blob/main/PRIVACY.md" target="_blank" rel="noopener">Privacidad</a>
            <a class="ghost-button" href="${REPOSITORY_URL}/blob/main/LICENSE" target="_blank" rel="noopener">Licencia</a>
            <a class="ghost-button" href="${WEB_URL}" target="_blank" rel="noopener">Versión web</a>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
      q('[data-experience-close]', dialog)?.addEventListener('click', () => dialog.close());
    }

    if (!$('mobileMoreSheet')) {
      const sheet = document.createElement('dialog');
      sheet.id = 'mobileMoreSheet';
      sheet.className = 'experience-sheet';
      sheet.innerHTML = `
        <div class="experience-dialog-head">
          <div><div class="eyebrow">DIPLOMAKER</div><h2>Más opciones</h2></div>
          <button class="icon-button" type="button" data-experience-close>×</button>
        </div>
        <div class="experience-sheet-body">
          <button type="button" data-mobile-view="data"><span>▦</span> Datos y asociación</button>
          <button type="button" data-mobile-view="templates"><span>◇</span> Plantillas</button>
          <button type="button" data-mobile-view="studio"><span>✦</span> Diseñar plantilla</button>
          <button type="button" data-mobile-projects><span>▣</span> Proyectos</button>
          <button type="button" data-mobile-theme><span data-theme-indicator>☀</span> Apariencia: <span data-theme-label>Claro</span></button>
          <button type="button" data-mobile-install><span>⇩</span> Instalar Diplomaker</button>
          <button type="button" data-mobile-about><span>ⓘ</span> Acerca de Diplomaker</button>
          <a href="${AUTHOR_URL}" target="_blank" rel="noopener"><span>↗</span> Marcelo Gómez en GitHub</a>
        </div>
      `;
      document.body.appendChild(sheet);
      q('[data-experience-close]', sheet)?.addEventListener('click', () => sheet.close());
      qa('[data-mobile-view]', sheet).forEach(button => button.addEventListener('click', () => {
        sheet.close();
        clickView(button.dataset.mobileView);
      }));
      q('[data-mobile-projects]', sheet)?.addEventListener('click', () => { sheet.close(); openProjectLibrary(); });
      q('[data-mobile-theme]', sheet)?.addEventListener('click', cycleTheme);
      q('[data-mobile-install]', sheet)?.addEventListener('click', () => { sheet.close(); triggerInstall(); });
      q('[data-mobile-about]', sheet)?.addEventListener('click', () => { sheet.close(); $('aboutExperienceDialog')?.showModal(); });
    }
  }

  function injectMobileNavigation() {
    if ($('mobileBottomNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'mobileBottomNav';
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Navegación móvil');
    nav.innerHTML = `
      <button type="button" data-mobile-primary="home"><span>⌂</span>Inicio</button>
      <button type="button" data-mobile-primary="create"><span>＋</span>Crear</button>
      <button type="button" data-mobile-primary="review"><span>✓</span>Revisión</button>
      <button type="button" data-mobile-primary="export"><span>⇩</span>Exportar</button>
      <button type="button" data-mobile-more><span>•••</span>Más</button>
    `;
    document.body.appendChild(nav);
    qa('[data-mobile-primary]', nav).forEach(button => button.addEventListener('click', () => clickView(button.dataset.mobilePrimary)));
    q('[data-mobile-more]', nav)?.addEventListener('click', () => $('mobileMoreSheet')?.showModal());
    syncMobileNavigation();
    const observer = new MutationObserver(syncMobileNavigation);
    const mainNav = $('mainNav');
    if (mainNav) observer.observe(mainNav, { attributes: true, subtree: true, attributeFilter: ['class'] });
  }

  function syncMobileNavigation() {
    const active = q('#mainNav .nav-item.active')?.dataset.view || 'home';
    qa('[data-mobile-primary]').forEach(button => button.classList.toggle('active', button.dataset.mobilePrimary === active));
    q('[data-mobile-more]')?.classList.toggle('active', !['home', 'create', 'review', 'export'].includes(active));
  }

  function clickView(name) {
    const button = q(`#mainNav [data-view="${CSS.escape(name)}"]`);
    if (button) {
      button.click();
      syncMobileNavigation();
      return true;
    }
    if (name === 'studio') {
      const studio = q('[data-studio-open]');
      if (studio) { studio.click(); return true; }
    }
    toast('La sección todavía no está disponible en esta vista.', 'error');
    return false;
  }

  function projectDisplayName(project) {
    const value = U.normalizeText(project?.name);
    return value || 'Proyecto sin título';
  }

  function formatDate(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function projectTemplateName(project) {
    try { return TL.getTemplate(project.activeTemplateId || project.draft?.templateId || 'classic').shortName; }
    catch (_) { return 'Plantilla personalizada'; }
  }

  async function openProjectLibrary() {
    const dialog = $('projectLibraryDialog');
    if (!dialog) return;
    dialog.showModal();
    await refreshProjectLibrary();
    await refreshStorageStatus();
  }

  async function refreshProjectLibrary() {
    const list = $('projectLibraryList');
    if (!list) return;
    list.innerHTML = '<div class="project-empty"><strong>Cargando proyectos…</strong></div>';
    try {
      const projects = await Storage.listProjects();
      if (!projects.length) {
        list.innerHTML = '<div class="project-empty"><strong>No hay proyectos guardados.</strong>Creá uno nuevo o abrí un archivo .diplomaker.</div>';
        return;
      }
      list.innerHTML = projects.map(project => `
        <article class="project-card" data-project-id="${escapeHTML(project.id)}">
          <div>
            <h3 title="${escapeHTML(projectDisplayName(project))}">${escapeHTML(projectDisplayName(project))}</h3>
            <div class="project-card-meta">
              <span>${Number(project.records?.length || 0)} certificado${Number(project.records?.length || 0) === 1 ? '' : 's'}</span>
              <span>${escapeHTML(projectTemplateName(project))}</span>
              <span>Actualizado ${escapeHTML(formatDate(project.updatedAt))}</span>
            </div>
          </div>
          <div class="project-card-actions">
            <button class="primary-button small" type="button" data-project-open>Abrir</button>
            <button class="secondary-button small" type="button" data-project-rename>Renombrar</button>
            <button class="ghost-button small" type="button" data-project-duplicate>Duplicar</button>
            <button class="ghost-button small" type="button" data-project-export>Exportar</button>
            <button class="ghost-button small" type="button" data-project-delete>Eliminar</button>
          </div>
        </article>
      `).join('');
      qa('[data-project-id]', list).forEach(card => {
        const id = card.dataset.projectId;
        q('[data-project-open]', card)?.addEventListener('click', () => openStoredProject(id));
        q('[data-project-rename]', card)?.addEventListener('click', () => renameStoredProject(id));
        q('[data-project-duplicate]', card)?.addEventListener('click', () => duplicateStoredProject(id));
        q('[data-project-export]', card)?.addEventListener('click', () => exportStoredProject(id));
        q('[data-project-delete]', card)?.addEventListener('click', () => deleteStoredProject(id));
      });
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="project-empty"><strong>No se pudo leer la biblioteca.</strong>El almacenamiento local devolvió un error.</div>';
    }
  }

  function defaultProject() {
    const draft = TL.defaultRecord('classic');
    draft.eventText = '';
    return {
      id: U.uuid('project'),
      format: 'diplomaker-project',
      version: '2.2.0',
      name: 'Proyecto sin título',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: 'individual',
      activeTemplateId: 'classic',
      draft,
      records: [],
      selectedRecordId: null,
      filenamePattern: '{NOMBRE}',
      sourceData: null,
      selectedSheetIndex: 0,
      mapping: {}
    };
  }

  async function createBlankProject() {
    const project = defaultProject();
    await Storage.saveProject(project);
    openProjectObject(project);
  }

  function openProjectObject(project) {
    try {
      const payload = Storage.exportProject(project);
      const file = new File([payload], `${U.slugify(projectDisplayName(project)) || 'Proyecto_Diplomaker'}.diplomaker`, { type: 'application/json' });
      const input = $('projectFileInput');
      if (!input || typeof DataTransfer === 'undefined') throw new Error('El navegador no permite la apertura directa.');
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      $('projectLibraryDialog')?.close();
    } catch (error) {
      console.warn(error);
      U.downloadBlob(Storage.exportProject(project), `${U.slugify(projectDisplayName(project)) || 'Proyecto_Diplomaker'}.diplomaker`);
      toast('El proyecto se descargó. Abrilo desde “Abrir proyecto”.', 'success');
    }
  }

  async function openStoredProject(id) {
    const project = await Storage.loadProject(id);
    if (!project) return toast('El proyecto ya no existe.', 'error');
    openProjectObject(project);
  }

  async function renameStoredProject(id) {
    const project = await Storage.loadProject(id);
    if (!project) return;
    const name = window.prompt('Nombre del proyecto', projectDisplayName(project));
    if (!name?.trim()) return;
    project.name = name.trim().slice(0, 120);
    await Storage.saveProject(project);
    await refreshProjectLibrary();
    toast('Proyecto renombrado.', 'success');
  }

  async function duplicateStoredProject(id) {
    const project = await Storage.loadProject(id);
    if (!project) return;
    const copy = U.deepClone(project);
    copy.id = U.uuid('project');
    copy.name = `${projectDisplayName(project)} — copia`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    await Storage.saveProject(copy);
    await refreshProjectLibrary();
    toast('Copia creada.', 'success');
  }

  async function exportStoredProject(id) {
    const project = await Storage.loadProject(id);
    if (!project) return;
    U.downloadBlob(Storage.exportProject(project), `${U.slugify(projectDisplayName(project)) || 'Proyecto_Diplomaker'}.diplomaker`);
    toast('Proyecto exportado.', 'success');
  }

  async function deleteStoredProject(id) {
    const project = await Storage.loadProject(id);
    if (!project) return;
    if (!window.confirm(`¿Eliminar “${projectDisplayName(project)}” de este dispositivo? Esta acción no elimina las copias exportadas.`)) return;
    if (typeof Storage.deleteProject !== 'function') return toast('La eliminación local todavía no está disponible.', 'error');
    await Storage.deleteProject(id);
    await refreshProjectLibrary();
    toast('Proyecto eliminado.', 'success');
  }

  async function backupAllProjects() {
    try {
      const projects = await Storage.listProjects();
      if (!projects.length) throw new Error('No hay proyectos para respaldar.');
      if (!window.JSZip) throw new Error('No se encontró el módulo ZIP.');
      const zip = new window.JSZip();
      const manifest = {
        format: 'diplomaker-backup',
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        projects: projects.map(project => ({ id: project.id, name: projectDisplayName(project), updatedAt: project.updatedAt }))
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      projects.forEach(project => {
        const filename = `${U.slugify(projectDisplayName(project)) || project.id}.diplomaker`;
        zip.folder('projects').file(filename, JSON.stringify({ format: 'diplomaker-project', version: '2.2.0', exportedAt: new Date().toISOString(), project }, null, 2));
      });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      U.downloadBlob(blob, `Diplomaker_Respaldo_${new Date().toISOString().slice(0, 10)}.zip`);
      toast(`${projects.length} proyecto${projects.length === 1 ? '' : 's'} respaldado${projects.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      toast(error.message || 'No se pudo crear el respaldo.', 'error');
    }
  }

  async function restoreProjectsBackup(file) {
    const input = $('restoreProjectsInput');
    try {
      if (!file) return;
      if (!window.JSZip) throw new Error('No se encontró el módulo ZIP.');
      const zip = await window.JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(entry => !entry.dir && entry.name.startsWith('projects/') && entry.name.endsWith('.diplomaker'));
      if (!entries.length) throw new Error('El ZIP no contiene proyectos Diplomaker.');
      let restored = 0;
      for (const entry of entries) {
        const raw = await entry.async('string');
        const parsed = JSON.parse(raw);
        const project = parsed.project || parsed;
        if (!project?.records || !Array.isArray(project.records)) continue;
        if (!project.id) project.id = U.uuid('project');
        await Storage.saveProject(project);
        restored++;
      }
      if (!restored) throw new Error('No se encontró ningún proyecto compatible.');
      await refreshProjectLibrary();
      toast(`${restored} proyecto${restored === 1 ? '' : 's'} restaurado${restored === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'No se pudo restaurar el respaldo.', 'error');
    } finally {
      if (input) input.value = '';
    }
  }

  async function storageDetails() {
    const result = { persistent: null, usage: null, quota: null };
    if (!navigator.storage) return result;
    try {
      if (navigator.storage.persisted) result.persistent = await navigator.storage.persisted();
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        result.usage = estimate.usage ?? null;
        result.quota = estimate.quota ?? null;
      }
    } catch (error) { console.warn('No se pudo consultar el almacenamiento.', error); }
    return result;
  }

  function humanBytes(value) {
    if (!Number.isFinite(value)) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let amount = value;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index++; }
    return `${amount.toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  async function refreshStorageStatus() {
    const text = $('storagePersistenceText');
    const button = $('requestPersistenceButton');
    if (!text || !button) return;
    const details = await storageDetails();
    const usage = details.usage != null && details.quota != null ? ` Uso: ${humanBytes(details.usage)} de ${humanBytes(details.quota)}.` : '';
    if (details.persistent === true) {
      text.textContent = `El navegador confirmó almacenamiento persistente.${usage}`;
      button.textContent = 'Protegido';
      button.disabled = true;
    } else if (!navigator.storage?.persist) {
      text.textContent = `Este navegador no ofrece una solicitud explícita de persistencia.${usage}`;
      button.textContent = 'No disponible';
      button.disabled = true;
    } else {
      text.textContent = `Los proyectos se guardan localmente, pero el navegador todavía no confirmó persistencia.${usage}`;
      button.textContent = 'Proteger almacenamiento';
      button.disabled = false;
    }
  }

  async function requestPersistentStorage() {
    try {
      if (!navigator.storage?.persist) throw new Error('El navegador no admite esta función.');
      const granted = await navigator.storage.persist();
      await refreshStorageStatus();
      toast(granted ? 'El almacenamiento local quedó protegido.' : 'El navegador no concedió persistencia. Conservá copias .diplomaker.', granted ? 'success' : '');
    } catch (error) {
      toast(error.message || 'No se pudo solicitar persistencia.', 'error');
    }
  }

  function configureInstallExperience() {
    const installButton = $('installExperienceButton');
    if (standaloneMode()) {
      installButton?.setAttribute('hidden', '');
      qa('[data-mobile-install]').forEach(button => { button.style.display = 'none'; });
      return;
    }
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      installButton?.removeAttribute('hidden');
      qa('[data-mobile-install]').forEach(button => { button.style.display = ''; });
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      installButton?.setAttribute('hidden', '');
      qa('[data-mobile-install]').forEach(button => { button.style.display = 'none'; });
      toast('Diplomaker se instaló correctamente.', 'success');
    });
  }

  async function triggerInstall() {
    if (standaloneMode()) return toast('Diplomaker ya está instalado en este dispositivo.', 'success');
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      const result = await prompt.prompt();
      if (result?.outcome === 'accepted') toast('Instalación aceptada.', 'success');
      return;
    }
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const message = isiOS
      ? 'En Safari, abrí Compartir y elegí “Agregar a pantalla de inicio”.'
      : 'Usá el menú del navegador y elegí “Instalar aplicación” o “Agregar a la pantalla principal”.';
    window.alert(`${message}\n\nLa instalación conserva Diplomaker como aplicación independiente y permite trabajar sin conexión después de la primera carga.`);
  }

  function createUpdateBanner(version, notes = '') {
    if ($('diplomakerUpdateBanner')) return;
    if (localStorage.getItem(UPDATE_DISMISSED_KEY) === version) return;
    const banner = document.createElement('div');
    banner.id = 'diplomakerUpdateBanner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <div><strong>Nueva versión disponible: ${escapeHTML(version)}</strong><small>${escapeHTML(notes || 'Incluye mejoras de interfaz y estabilidad.')}</small></div>
      <div class="update-banner-actions">
        <button class="primary-button small" type="button" data-update-now>Actualizar ahora</button>
        <button class="ghost-button small" type="button" data-update-later>Más tarde</button>
      </div>
    `;
    document.body.appendChild(banner);
    q('[data-update-now]', banner)?.addEventListener('click', activateUpdate);
    q('[data-update-later]', banner)?.addEventListener('click', () => {
      localStorage.setItem(UPDATE_DISMISSED_KEY, version);
      banner.remove();
    });
  }

  async function checkForVersionUpdate() {
    if (!location.protocol.startsWith('http')) return;
    try {
      const response = await fetch(`./version.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const remote = await response.json();
      if (remote.version && remote.version !== APP_VERSION) createUpdateBanner(remote.version, remote.summary);
    } catch (error) { console.debug('No se pudo comprobar la versión.', error); }
  }

  async function activateUpdate() {
    if (!('serviceWorker' in navigator)) return location.reload();
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      await registration?.update();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('diplomaker-')).map(key => caches.delete(key)));
      }
      location.href = `${location.pathname}?actualizar=${Date.now()}`;
    } catch (error) {
      console.error(error);
      location.reload();
    }
  }

  function configureServiceWorkerUpdates() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      location.reload();
    });
    navigator.serviceWorker.ready.then(registration => {
      if (registration.waiting) createUpdateBanner('actualización disponible', 'Una nueva edición ya fue descargada.');
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) createUpdateBanner('actualización disponible', 'Una nueva edición ya fue descargada.');
        });
      });
    }).catch(() => {});
  }

  function ensureExternalLinksSafe() {
    qa('a[target="_blank"]').forEach(link => {
      const rel = new Set(String(link.rel || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.rel = [...rel].join(' ');
    });
  }

  function init() {
    currentThemePreference = normalizedThemePreference(localStorage.getItem(THEME_KEY) || 'light');
    applyTheme(currentThemePreference, false);
    injectBranding();
    createDialogs();
    injectTopbarActions();
    injectMobileNavigation();
    configureInstallExperience();
    configureServiceWorkerUpdates();
    checkForVersionUpdate();
    ensureExternalLinksSafe();

    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (currentThemePreference === 'system') applyTheme('system', false);
    });

    setTimeout(() => {
      injectBranding();
      syncMobileNavigation();
      ensureExternalLinksSafe();
    }, 350);
  }

  DM.Experience = {
    version: APP_VERSION,
    openProjectLibrary,
    applyTheme,
    triggerInstall,
    checkForVersionUpdate
  };

  init();
})();
