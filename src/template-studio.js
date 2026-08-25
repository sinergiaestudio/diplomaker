(function bootTemplateStudio() {
  'use strict';

  const DM = window.Diplomaker = window.Diplomaker || {};
  if (!DM.Utils || !DM.TemplateLibrary || !DM.Renderer || !DM.Storage) {
    setTimeout(bootTemplateStudio, 0);
    return;
  }
  if (DM.TemplateStudio) return;

  const U = DM.Utils;
  const TL = DM.TemplateLibrary;
  const R = DM.Renderer;
  const Storage = DM.Storage;

  const STUDIO_VERSION = '2.1-public.1';
  const TEMPLATE_FORMAT = 'diplomaker-template';
  const DB_NAME = 'diplomaker2-template-studio';
  const DB_VERSION = 1;
  const STORE = 'templates';
  const FALLBACK_KEY = 'diplomaker2:customTemplates';
  const BASE_WIDTH = R.BASE_WIDTH || 1120;
  const BASE_HEIGHT = R.BASE_HEIGHT || 792;
  const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
  const MAX_DATA_URL_CHARS = Math.ceil(MAX_IMAGE_BYTES * 1.5);
  const BUILTIN_IDS = new Set(TL.templates.map(template => template.id));

  const FIELD_OPTIONS = [
    { value: 'participantName', label: 'Nombre y apellido', sample: 'Sofía Martínez' },
    { value: 'treatmentParticipant', label: 'Tratamiento + nombre', sample: 'Dra. Sofía Martínez' },
    { value: 'treatment', label: 'Tratamiento', sample: 'Dra.' },
    { value: 'certificateType', label: 'Tipo de certificado', sample: 'ASISTENCIA' },
    { value: 'eventTitle', label: 'Evento o actividad', sample: 'Taller de herramientas digitales' },
    { value: 'eventDate', label: 'Fecha', sample: '24/08/2026' },
    { value: 'eventText', label: 'Texto personalizado', sample: 'En reconocimiento por su participación en la actividad.' },
    { value: 'certificateBody', label: 'Cuerpo automático del certificado', sample: 'En reconocimiento por su asistencia en “Taller de herramientas digitales”, realizada el 24/08/2026.' }
  ];

  const FONT_OPTIONS = [
    'Arial',
    'Georgia',
    'Trebuchet MS',
    'Verdana',
    'Times New Roman',
    'Courier New',
    'system-ui'
  ];

  const SAMPLE_RECORD = {
    treatment: 'Dra.',
    participantName: 'Sofía Martínez',
    certificateType: 'ASISTENCIA',
    eventTitle: 'Taller de herramientas digitales',
    eventDate: '2026-08-24',
    eventText: 'En reconocimiento por su participación en la actividad.',
    signers: [
      { name: 'Andrea Molina', role: 'Coordinadora académica' },
      { name: 'Diego Herrera', role: 'Director del programa' }
    ]
  };

  const state = {
    draft: null,
    selectedElementId: null,
    history: [],
    historyIndex: -1,
    zoom: 0.66,
    isDirty: false,
    pointer: null,
    readyPromise: null,
    loadedTemplates: [],
    renderQueued: false,
    lastSavedId: null
  };

  function escape(value) {
    return U.escapeHTML(value);
  }

  function normalizeId(value) {
    return U.slugify(value || 'plantilla').toLocaleLowerCase('es-AR').replace(/_/g, '-');
  }

  function sanitizeColor(value, fallback = 'transparent') {
    const raw = String(value ?? '').trim();
    if (raw === 'transparent') return raw;
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
    if (/^rgba?\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(raw)) return raw;
    return fallback;
  }

  function sanitizeFontFamily(value, fallback = 'Arial') {
    const raw = String(value || '').trim();
    return FONT_OPTIONS.includes(raw) ? raw : fallback;
  }

  function sanitizeEnum(value, allowed, fallback) {
    const raw = String(value || '');
    return allowed.includes(raw) ? raw : fallback;
  }

  function sanitizeSvgDataURL(raw) {
    try {
      const comma = raw.indexOf(',');
      if (comma < 0) return '';
      const meta = raw.slice(0, comma);
      const body = raw.slice(comma + 1);
      let source;
      if (/;base64/i.test(meta)) {
        const binary = atob(body);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        source = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      } else {
        source = decodeURIComponent(body);
      }
      const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (doc.querySelector('parsererror') || doc.documentElement?.localName !== 'svg') return '';
      doc.querySelectorAll('script,style,foreignObject,iframe,object,embed,link,meta,audio,video,canvas').forEach(node => node.remove());
      for (const node of doc.querySelectorAll('*')) {
        for (const attr of [...node.attributes]) {
          const name = attr.name.toLocaleLowerCase('en-US');
          const value = attr.value.trim();
          if (name.startsWith('on')) { node.removeAttribute(attr.name); continue; }
          if ((name === 'href' || name === 'xlink:href') && !value.startsWith('#') && !/^data:image\/(?:png|jpe?g|webp|gif)(?:;base64)?,/i.test(value)) {
            node.removeAttribute(attr.name); continue;
          }
          if (name === 'style' && /url\s*\(|expression\s*\(|@import/i.test(value)) { node.removeAttribute(attr.name); continue; }
          if (/url\s*\(/i.test(value) && !/^url\(#[a-zA-Z0-9_.:-]+\)$/i.test(value)) { node.removeAttribute(attr.name); continue; }
          if (/javascript:|vbscript:|data:text\/html/i.test(value)) node.removeAttribute(attr.name);
        }
      }
      const clean = new XMLSerializer().serializeToString(doc.documentElement);
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
    } catch (_) {
      return '';
    }
  }

  function safeImageSource(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > MAX_DATA_URL_CHARS) return '';
    if (/^data:image\/svg\+xml(?:;charset=[^;,]+)?(?:;base64)?,/i.test(raw)) return sanitizeSvgDataURL(raw);
    return /^data:image\/(?:png|jpe?g|webp|gif)(?:;charset=[^;,]+)?(?:;base64)?,/i.test(raw) ? raw : '';
  }

  function sanitizeAsset(asset) {
    const src = safeImageSource(asset?.src);
    if (!src) return null;
    return {
      id: String(asset?.id || U.uuid('asset')).replace(/[^a-zA-Z0-9_-]/g, '-'),
      name: U.normalizeText(asset?.name || 'Logo').slice(0, 100),
      src
    };
  }

  function dataURLFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || '').startsWith('image/')) {
        reject(new Error('Seleccioná un archivo de imagen válido.'));
        return;
      }
      if (Number(file.size || 0) > MAX_IMAGE_BYTES) {
        reject(new Error('La imagen supera el límite de 15 MB. Reducí su tamaño antes de incorporarla.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const source = safeImageSource(reader.result);
        if (!source) reject(new Error('El formato de imagen no es compatible.'));
        else resolve(source);
      };
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  function openStudioDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB no está disponible.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir la biblioteca de plantillas.'));
    });
  }

  async function idbGetAll() {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error || new Error('No se pudieron leer las plantillas.'));
      };
    });
  }

  async function idbPut(template) {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(template);
      tx.oncomplete = () => {
        db.close();
        resolve(template);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('No se pudo guardar la plantilla.'));
      };
    });
  }

  async function idbDelete(id) {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('No se pudo eliminar la plantilla.'));
      };
    });
  }

  function fallbackRead() {
    try {
      const raw = localStorage.getItem(FALLBACK_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function fallbackWrite(templates) {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(templates));
    } catch (error) {
      console.warn('No se pudo usar el almacenamiento alternativo.', error);
    }
  }

  async function listStoredTemplates() {
    try {
      return await idbGetAll();
    } catch (error) {
      console.warn('La biblioteca IndexedDB no está disponible; se usará almacenamiento alternativo.', error);
      return fallbackRead();
    }
  }

  async function saveStoredTemplate(template) {
    try {
      await idbPut(template);
    } catch (error) {
      console.warn('No se pudo guardar en IndexedDB; se usará almacenamiento alternativo.', error);
      const all = fallbackRead().filter(item => item.id !== template.id);
      all.push(template);
      fallbackWrite(all);
    }
  }

  async function deleteStoredTemplate(id) {
    try {
      await idbDelete(id);
    } catch (error) {
      console.warn('No se pudo eliminar de IndexedDB; se usará almacenamiento alternativo.', error);
      fallbackWrite(fallbackRead().filter(item => item.id !== id));
    }
  }

  function blankBackgroundData(color = '#fffdf8', accent = '#17365d') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="792" viewBox="0 0 1120 792"><rect width="1120" height="792" fill="${color}"/><rect x="28" y="28" width="1064" height="736" rx="8" fill="none" stroke="${accent}" stroke-width="3"/><rect x="40" y="40" width="1040" height="712" rx="6" fill="none" stroke="${accent}" stroke-width="1" opacity=".45"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function createElement(type, overrides = {}) {
    const common = {
      id: U.uuid('element'),
      type,
      name: 'Elemento',
      x: 160,
      y: 120,
      width: 800,
      height: 80,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      z: Date.now()
    };
    const defaults = {
      text: {
        name: 'Texto fijo',
        text: 'CERTIFICADO',
        field: '',
        fontFamily: 'Georgia',
        fontSize: 52,
        minFontSize: 18,
        fontWeight: 700,
        italic: false,
        underline: false,
        color: '#17365d',
        align: 'center',
        valign: 'middle',
        lineHeight: 1.18,
        letterSpacing: 0,
        uppercase: false,
        autoFit: true,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        padding: 4
      },
      image: {
        name: 'Imagen',
        src: '',
        fit: 'contain',
        borderRadius: 0,
        backgroundColor: 'transparent',
        width: 220,
        height: 100
      },
      line: {
        name: 'Línea',
        color: '#17365d',
        lineWidth: 2,
        dash: 'solid',
        height: 12
      },
      rect: {
        name: 'Rectángulo',
        fill: 'transparent',
        stroke: '#17365d',
        lineWidth: 2,
        borderRadius: 0,
        width: 300,
        height: 120
      },
      ellipse: {
        name: 'Círculo / elipse',
        fill: 'transparent',
        stroke: '#17365d',
        lineWidth: 2,
        width: 140,
        height: 140
      },
      signerGroup: {
        name: 'Firmantes',
        width: 760,
        height: 150,
        x: 180,
        y: 585,
        columns: 2,
        maxSigners: 8,
        showLine: true,
        lineColor: 'rgba(23,54,93,.32)',
        textColor: '#24364f',
        nameFontFamily: 'Arial',
        nameFontSize: 18,
        roleFontFamily: 'Arial',
        roleFontSize: 10,
        roleUppercase: true,
        gapX: 34,
        gapY: 12
      },
      logoGroup: {
        name: 'Franja de logos',
        width: 900,
        height: 90,
        x: 110,
        y: 680,
        columns: 6,
        gap: 20,
        padding: 8,
        assets: []
      }
    };
    return { ...common, ...(defaults[type] || {}), ...overrides };
  }

  function defaultTemplateDefinition() {
    const now = new Date().toISOString();
    return {
      id: U.uuid('custom'),
      name: 'Nueva plantilla',
      shortName: 'Nueva plantilla',
      institution: 'Plantilla personalizada',
      description: 'Diseño creado en el Estudio de plantillas.',
      defaultType: 'ASISTENCIA',
      defaultEventText: 'En reconocimiento por su participación en la actividad.',
      supportsSigners: 12,
      custom: true,
      createdAt: now,
      updatedAt: now,
      customDefinition: {
        format: TEMPLATE_FORMAT,
        version: STUDIO_VERSION,
        page: {
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          backgroundColor: '#fffdf8',
          backgroundData: blankBackgroundData('#fffdf8', '#17365d')
        },
        elements: [
          createElement('text', { name: 'Título', text: 'CERTIFICADO', x: 160, y: 115, width: 800, height: 75, fontSize: 54 }),
          createElement('text', { name: 'Tipo de certificado', field: 'certificateType', text: '', x: 170, y: 188, width: 780, height: 55, fontFamily: 'Arial', fontSize: 26, fontWeight: 700, color: '#9b762f', letterSpacing: 3, uppercase: true }),
          createElement('text', { name: 'Leyenda', text: 'Se otorga a:', x: 310, y: 252, width: 500, height: 42, fontFamily: 'Georgia', fontSize: 18, fontWeight: 400, italic: true, color: '#4c5664' }),
          createElement('text', { name: 'Nombre del participante', field: 'treatmentParticipant', text: '', x: 130, y: 298, width: 860, height: 82, fontFamily: 'Georgia', fontSize: 50, minFontSize: 22, fontWeight: 700, color: '#1e2d42' }),
          createElement('text', { name: 'Cuerpo del certificado', field: 'certificateBody', text: '', x: 175, y: 402, width: 770, height: 120, fontFamily: 'Arial', fontSize: 17, minFontSize: 11, fontWeight: 400, color: '#364152', lineHeight: 1.35 }),
          createElement('signerGroup', { name: 'Firmantes' })
        ]
      }
    };
  }

  function sanitizeTemplate(template) {
    const source = U.deepClone(template || {});
    const definition = source.customDefinition || source.definition || source;
    const page = definition.page || {};
    const elements = Array.isArray(definition.elements) ? definition.elements : [];
    const now = new Date().toISOString();
    const id = String(source.id || definition.id || U.uuid('custom')).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 140) || U.uuid('custom');
    const name = U.normalizeText(source.name || definition.name || 'Plantilla personalizada').slice(0, 80) || 'Plantilla personalizada';
    const pageColor = sanitizeColor(page.backgroundColor, '#ffffff');
    const allowedFields = new Set(FIELD_OPTIONS.map(option => option.value));

    return {
      id,
      name,
      shortName: U.normalizeText(source.shortName || name).slice(0, 80) || name,
      institution: U.normalizeText(source.institution || 'Plantilla personalizada').slice(0, 120),
      description: U.normalizeText(source.description || 'Diseño creado en Diplomaker.').slice(0, 500),
      defaultType: U.normalizeText(source.defaultType || 'ASISTENCIA').toLocaleUpperCase('es-AR').slice(0, 80),
      defaultEventText: U.normalizeText(source.defaultEventText || 'En reconocimiento por su participación en la actividad.').slice(0, 1000),
      supportsSigners: U.clamp(Number(source.supportsSigners || 12), 1, 12),
      custom: true,
      createdAt: source.createdAt || now,
      updatedAt: source.updatedAt || now,
      background: safeImageSource(page.backgroundData) || blankBackgroundData(pageColor, '#17365d'),
      palette: (Array.isArray(source.palette) ? source.palette : [pageColor]).map(color => sanitizeColor(color, pageColor)).slice(0, 12),
      customDefinition: {
        format: TEMPLATE_FORMAT,
        version: STUDIO_VERSION,
        page: {
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          backgroundColor: pageColor,
          backgroundData: safeImageSource(page.backgroundData)
        },
        elements: elements.slice(0, 250).map((element, index) => {
          const allowedTypes = ['text', 'image', 'line', 'rect', 'ellipse', 'signerGroup', 'logoGroup'];
          const type = allowedTypes.includes(element?.type) ? element.type : 'text';
          const clean = {
            ...createElement(type),
            ...element,
            type,
            id: String(element?.id || U.uuid('element')).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 140) || U.uuid('element'),
            name: U.normalizeText(element?.name || type).slice(0, 100),
            z: U.clamp(Number.isFinite(Number(element?.z)) ? Number(element.z) : index + 1, -1000000, 1000000),
            visible: element?.visible !== false,
            locked: element?.locked === true
          };
          clean.x = U.clamp(Number(clean.x || 0), -BASE_WIDTH, BASE_WIDTH * 2);
          clean.y = U.clamp(Number(clean.y || 0), -BASE_HEIGHT, BASE_HEIGHT * 2);
          clean.width = U.clamp(Number(clean.width || 1), 1, BASE_WIDTH * 2);
          clean.height = U.clamp(Number(clean.height || 1), 1, BASE_HEIGHT * 2);
          clean.opacity = U.clamp(Number(clean.opacity ?? 1), 0, 1);
          clean.rotation = U.clamp(Number(clean.rotation || 0), -360, 360);

          if (type === 'text') {
            clean.text = String(clean.text || '').replace(/\u0000/g, '').slice(0, 5000);
            clean.field = allowedFields.has(clean.field) ? clean.field : '';
            clean.fontFamily = sanitizeFontFamily(clean.fontFamily, 'Arial');
            clean.fontSize = U.clamp(Number(clean.fontSize || 20), 6, 220);
            clean.minFontSize = U.clamp(Number(clean.minFontSize || 10), 6, clean.fontSize);
            clean.fontWeight = [300, 400, 600, 700, 800].includes(Number(clean.fontWeight)) ? Number(clean.fontWeight) : 400;
            clean.color = sanitizeColor(clean.color, '#111111');
            clean.align = sanitizeEnum(clean.align, ['left', 'center', 'right'], 'center');
            clean.valign = sanitizeEnum(clean.valign, ['top', 'middle', 'bottom'], 'middle');
            clean.lineHeight = U.clamp(Number(clean.lineHeight || 1.2), .8, 3);
            clean.letterSpacing = U.clamp(Number(clean.letterSpacing || 0), -4, 30);
            clean.backgroundColor = sanitizeColor(clean.backgroundColor, 'transparent');
            clean.borderColor = sanitizeColor(clean.borderColor, 'transparent');
            clean.borderWidth = U.clamp(Number(clean.borderWidth || 0), 0, 20);
            clean.borderRadius = U.clamp(Number(clean.borderRadius || 0), 0, 100);
            clean.padding = U.clamp(Number(clean.padding || 0), 0, 80);
            clean.italic = clean.italic === true;
            clean.underline = clean.underline === true;
            clean.uppercase = clean.uppercase === true;
            clean.autoFit = clean.autoFit !== false;
          } else if (type === 'image') {
            clean.src = safeImageSource(clean.src);
            clean.fit = sanitizeEnum(clean.fit, ['contain', 'cover', 'stretch'], 'contain');
            clean.borderRadius = U.clamp(Number(clean.borderRadius || 0), 0, 100);
            clean.backgroundColor = sanitizeColor(clean.backgroundColor, 'transparent');
          } else if (type === 'line') {
            clean.color = sanitizeColor(clean.color, '#17365d');
            clean.lineWidth = U.clamp(Number(clean.lineWidth || 2), 1, 30);
            clean.dash = sanitizeEnum(clean.dash, ['solid', 'dashed', 'dotted'], 'solid');
          } else if (type === 'rect' || type === 'ellipse') {
            clean.fill = sanitizeColor(clean.fill, 'transparent');
            clean.stroke = sanitizeColor(clean.stroke, '#17365d');
            clean.lineWidth = U.clamp(Number(clean.lineWidth || 2), 0, 30);
            clean.borderRadius = U.clamp(Number(clean.borderRadius || 0), 0, 100);
          } else if (type === 'signerGroup') {
            clean.columns = U.clamp(Number(clean.columns || 2), 1, 4);
            clean.maxSigners = U.clamp(Number(clean.maxSigners || 8), 1, 12);
            clean.lineColor = sanitizeColor(clean.lineColor, 'rgba(0,0,0,.25)');
            clean.textColor = sanitizeColor(clean.textColor, '#24364f');
            clean.nameFontFamily = sanitizeFontFamily(clean.nameFontFamily, 'Arial');
            clean.roleFontFamily = sanitizeFontFamily(clean.roleFontFamily, 'Arial');
            clean.nameFontSize = U.clamp(Number(clean.nameFontSize || 18), 8, 50);
            clean.roleFontSize = U.clamp(Number(clean.roleFontSize || 10), 6, 30);
            clean.gapX = U.clamp(Number(clean.gapX || 34), 0, 120);
            clean.gapY = U.clamp(Number(clean.gapY || 12), 0, 120);
            clean.showLine = clean.showLine !== false;
            clean.roleUppercase = clean.roleUppercase !== false;
          } else if (type === 'logoGroup') {
            clean.columns = U.clamp(Number(clean.columns || 6), 1, 12);
            clean.gap = U.clamp(Number(clean.gap || 20), 0, 100);
            clean.padding = U.clamp(Number(clean.padding || 8), 0, 80);
            clean.assets = (Array.isArray(clean.assets) ? clean.assets : []).map(sanitizeAsset).filter(Boolean).slice(0, 48);
          }
          return clean;
        })
      }
    };
  }

  function registerTemplate(template) {
    const clean = sanitizeTemplate(template);
    const index = TL.templates.findIndex(item => item.id === clean.id);
    if (index >= 0) TL.templates.splice(index, 1, clean);
    else TL.templates.push(clean);
    return clean;
  }

  function unregisterTemplate(id) {
    const index = TL.templates.findIndex(item => item.id === id && item.custom);
    if (index >= 0) TL.templates.splice(index, 1);
  }

  function customTemplates() {
    return TL.templates.filter(template => template.custom && template.customDefinition);
  }

  async function loadCustomTemplates() {
    const stored = await listStoredTemplates();
    state.loadedTemplates = stored.map(registerTemplate);
    updateTemplateCounters();
    return state.loadedTemplates;
  }

  function collectProjectTemplates(project) {
    if (!project) return [];
    const ids = new Set();
    [project.activeTemplateId, project.draft?.templateId].filter(Boolean).forEach(id => ids.add(id));
    (project.records || []).forEach(record => record?.templateId && ids.add(record.templateId));
    return customTemplates().filter(template => ids.has(template.id)).map(template => U.deepClone(template));
  }

  async function registerBundle(bundle, persist = true) {
    if (!Array.isArray(bundle)) return [];
    const registered = [];
    for (const raw of bundle) {
      try {
        const template = registerTemplate(raw);
        registered.push(template);
        if (persist) await saveStoredTemplate(template);
      } catch (error) {
        console.warn('No se pudo registrar una plantilla incluida en el proyecto.', error);
      }
    }
    updateTemplateCounters();
    return registered;
  }

  function patchStorage() {
    const original = {
      loadLastProject: Storage.loadLastProject.bind(Storage),
      loadProject: Storage.loadProject.bind(Storage),
      saveProject: Storage.saveProject.bind(Storage),
      exportProject: Storage.exportProject.bind(Storage),
      importProject: Storage.importProject.bind(Storage)
    };

    Storage.loadLastProject = async function () {
      await state.readyPromise;
      const project = await original.loadLastProject();
      if (project?.templateBundle) await registerBundle(project.templateBundle, true);
      return project;
    };

    Storage.loadProject = async function (id) {
      await state.readyPromise;
      const project = await original.loadProject(id);
      if (project?.templateBundle) await registerBundle(project.templateBundle, true);
      return project;
    };

    Storage.saveProject = async function (project) {
      await state.readyPromise;
      const enhanced = U.deepClone(project);
      enhanced.templateBundle = collectProjectTemplates(enhanced);
      return original.saveProject(enhanced);
    };

    Storage.exportProject = function (project) {
      const enhanced = U.deepClone(project);
      enhanced.templateBundle = collectProjectTemplates(enhanced);
      return original.exportProject(enhanced);
    };

    Storage.importProject = async function (file) {
      await state.readyPromise;
      const project = await original.importProject(file);
      if (project?.templateBundle) await registerBundle(project.templateBundle, true);
      return project;
    };
  }

  function patchTemplateResolver() {
    const originalResolve = TL.resolveTemplate.bind(TL);
    TL.resolveTemplate = function (value, fallback = 'classic') {
      const raw = U.normalizeHeader(value).replace(/_/g, ' ');
      if (raw) {
        const found = TL.templates.find(template => {
          if (!template.custom) return false;
          const values = [template.id, template.name, template.shortName].map(item => U.normalizeHeader(item).replace(/_/g, ' '));
          return values.includes(raw);
        });
        if (found) return found.id;
      }
      return originalResolve(value, fallback);
    };
  }

  function buildCertificateBody(record, template) {
    const type = String(record.certificateType || template.defaultType || 'ASISTENCIA').toLocaleLowerCase('es-AR');
    const event = U.normalizeText(record.eventTitle);
    const date = U.formatDate(record.eventDate);
    if (record.eventText && record.eventText !== template.defaultEventText) {
      let custom = U.normalizeText(record.eventText);
      if (event && !custom.toLocaleLowerCase('es-AR').includes(event.toLocaleLowerCase('es-AR'))) custom += ` ${event}`;
      if (date && !custom.includes(date)) custom += ` — ${date}`;
      return custom;
    }
    const roleTypes = ['panelista', 'disertante', 'docente', 'moderador', 'moderadora'];
    const lead = roleTypes.includes(type) ? `En reconocimiento por su participación en calidad de ${type}` : `En reconocimiento por su ${type}`;
    return `${lead}${event ? ` en “${event}”` : ''}${date && !event.includes(date) ? `, realizada el ${date}` : ''}.`;
  }

  function resolveField(field, record, template) {
    const fullName = [record.treatment, record.participantName].filter(Boolean).join(' ');
    const map = {
      participantName: record.participantName || '',
      treatmentParticipant: fullName,
      treatment: record.treatment || '',
      certificateType: record.certificateType || template.defaultType || '',
      eventTitle: record.eventTitle || '',
      eventDate: U.formatDate(record.eventDate),
      eventText: record.eventText || template.defaultEventText || '',
      certificateBody: buildCertificateBody(record, template)
    };
    return map[field] ?? '';
  }

  function replaceTokens(text, record, template) {
    const replacements = {
      '{NOMBRE}': record.participantName || '',
      '{TRATAMIENTO}': record.treatment || '',
      '{NOMBRE_COMPLETO}': [record.treatment, record.participantName].filter(Boolean).join(' '),
      '{TIPO}': record.certificateType || template.defaultType || '',
      '{TIPO_CERTIFICADO}': record.certificateType || template.defaultType || '',
      '{EVENTO}': record.eventTitle || '',
      '{FECHA}': U.formatDate(record.eventDate),
      '{TEXTO}': record.eventText || template.defaultEventText || '',
      '{CUERPO}': buildCertificateBody(record, template)
    };
    let value = String(text || '');
    for (const [token, replacement] of Object.entries(replacements)) value = value.split(token).join(replacement);
    return value;
  }

  function normalizeColor(value, fallback = '#111111') {
    const raw = String(value || '').trim();
    return raw || fallback;
  }

  function fontString(element, size) {
    const style = element.italic ? 'italic' : 'normal';
    const weight = Number(element.fontWeight || 400);
    const family = element.fontFamily || 'Arial';
    return `${style} ${weight} ${size}px ${family}`;
  }

  function measureLetterSpacing(ctx, text, spacing) {
    const chars = [...String(text || '')];
    return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * spacing;
  }

  function splitParagraph(ctx, text, maxWidth, letterSpacing = 0) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = words.shift();
    for (const word of words) {
      const candidate = `${line} ${word}`;
      const width = letterSpacing ? measureLetterSpacing(ctx, candidate, letterSpacing) : ctx.measureText(candidate).width;
      if (width <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
    return lines;
  }

  function wrapText(ctx, text, maxWidth, letterSpacing = 0) {
    const lines = [];
    const paragraphs = String(text || '').split(/\n/);
    paragraphs.forEach((paragraph, index) => {
      lines.push(...splitParagraph(ctx, paragraph, maxWidth, letterSpacing));
      if (index < paragraphs.length - 1 && paragraph === '') lines.push('');
    });
    return lines;
  }

  function drawLetterSpacedLine(ctx, text, x, y, align, width, spacing) {
    const chars = [...String(text || '')];
    const total = measureLetterSpacing(ctx, text, spacing);
    let start = x;
    if (align === 'center') start = x + (width - total) / 2;
    if (align === 'right') start = x + width - total;
    chars.forEach(char => {
      ctx.fillText(char, start, y);
      start += ctx.measureText(char).width + spacing;
    });
  }

  function drawTextBox(ctx, element, text, diagnostics) {
    const padding = Number(element.padding || 0);
    const innerX = element.x + padding;
    const innerY = element.y + padding;
    const innerW = Math.max(1, element.width - padding * 2);
    const innerH = Math.max(1, element.height - padding * 2);
    let content = String(text || '');
    if (element.uppercase) content = content.toLocaleUpperCase('es-AR');
    let size = Number(element.fontSize || 20);
    const minSize = Number(element.minFontSize || Math.max(8, Math.floor(size * .45)));
    const lineHeightFactor = Number(element.lineHeight || 1.2);
    const spacing = Number(element.letterSpacing || 0);
    let lines = [];
    let lineHeight = size * lineHeightFactor;
    let fits = false;

    while (size >= minSize) {
      ctx.font = fontString(element, size);
      lines = wrapText(ctx, content, innerW, spacing);
      lineHeight = size * lineHeightFactor;
      const maxLineWidth = lines.reduce((max, line) => Math.max(max, spacing ? measureLetterSpacing(ctx, line, spacing) : ctx.measureText(line).width), 0);
      fits = maxLineWidth <= innerW + .5 && lines.length * lineHeight <= innerH + .5;
      if (fits || element.autoFit === false) break;
      size -= 1;
    }

    if (!fits) diagnostics.push({ level: 'warning', message: `El campo “${element.name || 'Texto'}” excede su caja.` });
    else if (size < Number(element.fontSize || 20) * .78) diagnostics.push({ level: 'warning', message: `El campo “${element.name || 'Texto'}” debió reducirse.` });

    ctx.save();
    ctx.beginPath();
    ctx.rect(element.x, element.y, element.width, element.height);
    ctx.clip();
    if (element.backgroundColor && element.backgroundColor !== 'transparent') {
      ctx.fillStyle = element.backgroundColor;
      roundedRectPath(ctx, element.x, element.y, element.width, element.height, Number(element.borderRadius || 0));
      ctx.fill();
    }
    if (Number(element.borderWidth || 0) > 0 && element.borderColor !== 'transparent') {
      ctx.strokeStyle = normalizeColor(element.borderColor, '#000000');
      ctx.lineWidth = Number(element.borderWidth || 1);
      roundedRectPath(ctx, element.x, element.y, element.width, element.height, Number(element.borderRadius || 0));
      ctx.stroke();
    }
    ctx.font = fontString(element, size);
    ctx.fillStyle = normalizeColor(element.color, '#111111');
    ctx.textBaseline = 'top';
    const totalHeight = lines.length * lineHeight;
    let y = innerY;
    if (element.valign === 'middle') y = innerY + (innerH - totalHeight) / 2;
    if (element.valign === 'bottom') y = innerY + innerH - totalHeight;
    lines.forEach(line => {
      if (spacing) drawLetterSpacedLine(ctx, line, innerX, y, element.align || 'left', innerW, spacing);
      else {
        ctx.textAlign = element.align || 'left';
        const x = element.align === 'center' ? innerX + innerW / 2 : element.align === 'right' ? innerX + innerW : innerX;
        ctx.fillText(line, x, y);
      }
      if (element.underline) {
        const width = spacing ? measureLetterSpacing(ctx, line, spacing) : ctx.measureText(line).width;
        const start = element.align === 'center' ? innerX + (innerW - width) / 2 : element.align === 'right' ? innerX + innerW - width : innerX;
        ctx.fillRect(start, y + size + 1, width, Math.max(1, size / 18));
      }
      y += lineHeight;
    });
    ctx.restore();
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  async function drawImageElement(ctx, element, src, diagnostics) {
    if (!src) {
      diagnostics.push({ level: 'warning', message: `La imagen “${element.name || 'Imagen'}” no tiene archivo.` });
      return;
    }
    try {
      const image = await R.loadImage(src);
      const ratio = image.width / image.height;
      const boxRatio = element.width / element.height;
      let width = element.width;
      let height = element.height;
      let x = element.x;
      let y = element.y;
      if ((element.fit || 'contain') === 'contain') {
        if (ratio > boxRatio) {
          height = width / ratio;
          y += (element.height - height) / 2;
        } else {
          width = height * ratio;
          x += (element.width - width) / 2;
        }
      } else if ((element.fit || 'contain') === 'cover') {
        if (ratio > boxRatio) {
          width = height * ratio;
          x -= (width - element.width) / 2;
        } else {
          height = width / ratio;
          y -= (height - element.height) / 2;
        }
      }
      ctx.save();
      roundedRectPath(ctx, element.x, element.y, element.width, element.height, Number(element.borderRadius || 0));
      ctx.clip();
      if (element.backgroundColor && element.backgroundColor !== 'transparent') {
        ctx.fillStyle = element.backgroundColor;
        ctx.fillRect(element.x, element.y, element.width, element.height);
      }
      ctx.drawImage(image, x, y, width, height);
      ctx.restore();
    } catch (error) {
      diagnostics.push({ level: 'error', message: `No se pudo cargar “${element.name || 'Imagen'}”.` });
    }
  }

  function activeSigners(record, max = 12) {
    return (Array.isArray(record.signers) ? record.signers : [])
      .filter(signer => U.normalizeText(signer.name) || U.normalizeText(signer.role))
      .slice(0, max);
  }

  function drawSignerGroup(ctx, element, record, diagnostics) {
    const signers = activeSigners(record, Number(element.maxSigners || 12));
    if (!signers.length) {
      diagnostics.push({ level: 'warning', message: 'La plantilla contiene un bloque de firmantes, pero el certificado no tiene firmantes.' });
      return;
    }
    const columns = Math.max(1, Math.min(Number(element.columns || 2), signers.length));
    const rows = Math.ceil(signers.length / columns);
    const gapX = Number(element.gapX || 28);
    const gapY = Number(element.gapY || 10);
    const cellW = (element.width - gapX * (columns - 1)) / columns;
    const cellH = (element.height - gapY * (rows - 1)) / rows;
    signers.forEach((signer, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = element.x + col * (cellW + gapX);
      const y = element.y + row * (cellH + gapY);
      if (element.showLine !== false) {
        ctx.strokeStyle = element.lineColor || 'rgba(0,0,0,.25)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 10);
        ctx.lineTo(x + cellW - 10, y + 10);
        ctx.stroke();
      }
      const nameElement = {
        ...createElement('text'),
        name: `Nombre de ${signer.name || 'firmante'}`,
        x,
        y: y + 18,
        width: cellW,
        height: Math.max(26, cellH * .36),
        text: signer.name || '',
        fontFamily: element.nameFontFamily || 'Arial',
        fontSize: Number(element.nameFontSize || 18),
        minFontSize: 9,
        fontWeight: 700,
        color: element.textColor || '#222',
        align: 'center',
        valign: 'top',
        padding: 3
      };
      drawTextBox(ctx, nameElement, signer.name || '', diagnostics);
      const role = element.roleUppercase === false ? signer.role || '' : String(signer.role || '').toLocaleUpperCase('es-AR');
      const roleElement = {
        ...createElement('text'),
        name: `Cargo de ${signer.name || 'firmante'}`,
        x,
        y: y + Math.max(48, cellH * .43),
        width: cellW,
        height: Math.max(32, cellH * .5),
        text: role,
        fontFamily: element.roleFontFamily || 'Arial',
        fontSize: Number(element.roleFontSize || 10),
        minFontSize: 7,
        fontWeight: 500,
        color: element.textColor || '#222',
        align: 'center',
        valign: 'top',
        lineHeight: 1.12,
        padding: 3
      };
      drawTextBox(ctx, roleElement, role, diagnostics);
    });
  }

  async function drawLogoGroup(ctx, element, diagnostics) {
    const assets = Array.isArray(element.assets) ? element.assets.filter(asset => asset?.src) : [];
    if (!assets.length) {
      diagnostics.push({ level: 'warning', message: 'La franja de logos no contiene imágenes.' });
      return;
    }
    const columns = Math.max(1, Math.min(Number(element.columns || assets.length), assets.length));
    const rows = Math.ceil(assets.length / columns);
    const gap = Number(element.gap || 16);
    const padding = Number(element.padding || 6);
    const cellW = (element.width - gap * (columns - 1)) / columns;
    const cellH = (element.height - gap * (rows - 1)) / rows;
    for (let index = 0; index < assets.length; index++) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      await drawImageElement(ctx, {
        ...createElement('image'),
        name: assets[index].name || `Logo ${index + 1}`,
        src: assets[index].src,
        fit: 'contain',
        x: element.x + col * (cellW + gap) + padding,
        y: element.y + row * (cellH + gap) + padding,
        width: Math.max(1, cellW - padding * 2),
        height: Math.max(1, cellH - padding * 2)
      }, assets[index].src, diagnostics);
    }
  }

  async function drawCustomElement(ctx, element, record, template, diagnostics) {
    if (element.visible === false) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, Number(element.opacity ?? 1)));
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(Number(element.rotation || 0) * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    if (element.type === 'text') {
      const value = element.field ? resolveField(element.field, record, template) : replaceTokens(element.text, record, template);
      drawTextBox(ctx, element, value, diagnostics);
    } else if (element.type === 'image') {
      await drawImageElement(ctx, element, element.src, diagnostics);
    } else if (element.type === 'line') {
      ctx.strokeStyle = element.color || '#111';
      ctx.lineWidth = Number(element.lineWidth || 2);
      if (element.dash === 'dashed') ctx.setLineDash([10, 7]);
      if (element.dash === 'dotted') ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(element.x, element.y + element.height / 2);
      ctx.lineTo(element.x + element.width, element.y + element.height / 2);
      ctx.stroke();
    } else if (element.type === 'rect') {
      roundedRectPath(ctx, element.x, element.y, element.width, element.height, Number(element.borderRadius || 0));
      if (element.fill && element.fill !== 'transparent') {
        ctx.fillStyle = element.fill;
        ctx.fill();
      }
      if (Number(element.lineWidth || 0) > 0 && element.stroke !== 'transparent') {
        ctx.strokeStyle = element.stroke || '#111';
        ctx.lineWidth = Number(element.lineWidth || 1);
        ctx.stroke();
      }
    } else if (element.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.abs(element.width / 2), Math.abs(element.height / 2), 0, 0, Math.PI * 2);
      if (element.fill && element.fill !== 'transparent') {
        ctx.fillStyle = element.fill;
        ctx.fill();
      }
      if (Number(element.lineWidth || 0) > 0 && element.stroke !== 'transparent') {
        ctx.strokeStyle = element.stroke || '#111';
        ctx.lineWidth = Number(element.lineWidth || 1);
        ctx.stroke();
      }
    } else if (element.type === 'signerGroup') {
      drawSignerGroup(ctx, element, record, diagnostics);
    } else if (element.type === 'logoGroup') {
      await drawLogoGroup(ctx, element, diagnostics);
    }
    ctx.restore();
  }

  async function renderCustomCertificate(record, canvas, options = {}) {
    const scale = options.scale || 1;
    const template = TL.getTemplate(record.templateId);
    const definition = template.customDefinition;
    const elementsForValidation = definition.elements || [];
    const hasEventField = elementsForValidation.some(element => element.type === 'text' && ['eventTitle', 'eventText', 'certificateBody'].includes(element.field));
    const hasTypeField = elementsForValidation.some(element => element.type === 'text' && ['certificateType', 'certificateBody'].includes(element.field));
    const hasSignerGroup = elementsForValidation.some(element => element.type === 'signerGroup' && element.visible !== false);
    const diagnostics = R.baseValidation(record).filter(item => {
      const message = String(item.message || '').toLocaleLowerCase('es-AR');
      if (message.includes('evento o actividad') && !hasEventField) return false;
      if (message.includes('tipo de certificado') && !hasTypeField) return false;
      if (message.includes('firmantes') && !hasSignerGroup) return false;
      return true;
    });
    canvas.width = Math.round(BASE_WIDTH * scale);
    canvas.height = Math.round(BASE_HEIGHT * scale);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = definition.page.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    try {
      if (definition.page.backgroundData) {
        const image = await R.loadImage(definition.page.backgroundData);
        ctx.drawImage(image, 0, 0, BASE_WIDTH, BASE_HEIGHT);
      }
      const elements = [...definition.elements].filter(element => element.visible !== false).sort((a, b) => Number(a.z || 0) - Number(b.z || 0));
      const participantFields = elements.filter(element => element.type === 'text').some(element => element.field === 'participantName' || element.field === 'treatmentParticipant' || String(element.text || '').includes('{NOMBRE}'));
      if (!participantFields) diagnostics.push({ level: 'warning', message: 'La plantilla no contiene un campo para el nombre del participante.' });
      for (const element of elements) await drawCustomElement(ctx, element, record, template, diagnostics);
    } catch (error) {
      diagnostics.push({ level: 'error', message: error.message || 'No se pudo componer la plantilla personalizada.' });
    }
    ctx.restore();
    return { status: R.statusFromMessages(diagnostics), messages: diagnostics, template };
  }

  function patchRenderer() {
    const originalRenderCertificate = R.renderCertificate.bind(R);
    R.renderCertificate = async function (record, canvas, options = {}) {
      const template = TL.getTemplate(record.templateId);
      if (template.custom && template.customDefinition) return renderCustomCertificate(record, canvas, options);
      return originalRenderCertificate(record, canvas, options);
    };
    R.renderToCanvas = async function (record, scale = 2) {
      const canvas = document.createElement('canvas');
      const validation = await R.renderCertificate(record, canvas, { scale });
      return { canvas, validation };
    };
  }

  function studioToast(message, type = '') {
    const region = document.getElementById('toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    region.appendChild(node);
    setTimeout(() => node.remove(), 3800);
  }

  function injectStyles() {
    if (document.getElementById('dmStudioStyles')) return;
    const style = document.createElement('style');
    style.id = 'dmStudioStyles';
    style.textContent = `
      .studio-shell{display:grid;grid-template-columns:270px minmax(520px,1fr) 310px;gap:12px;min-height:calc(100vh - 150px)}
      .studio-sidebar,.studio-properties,.studio-center{min-width:0}
      .studio-sidebar,.studio-properties{display:flex;flex-direction:column;gap:12px}
      .studio-center{display:flex;flex-direction:column;gap:10px;overflow:hidden}
      .studio-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.035)}
      .studio-toolbar .studio-spacer{flex:1}
      .studio-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .studio-tool{display:flex;gap:8px;align-items:center;justify-content:flex-start;padding:9px 10px;border-radius:10px;font-size:12px}
      .studio-tool span{display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:6px;background:rgba(255,255,255,.08);font-weight:800;color:var(--text)}
      .studio-canvas-viewport{position:relative;flex:1;min-height:610px;overflow:auto;border:1px solid var(--border);border-radius:16px;background-color:#e8edf3;background-image:linear-gradient(45deg,#dfe5ec 25%,transparent 25%),linear-gradient(-45deg,#dfe5ec 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#dfe5ec 75%),linear-gradient(-45deg,transparent 75%,#dfe5ec 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0;padding:34px}
      .studio-canvas-holder{position:relative;margin:auto;transform-origin:top left}
      .studio-canvas{position:absolute;left:0;top:0;width:1120px;height:792px;background:#fff;box-shadow:0 18px 55px rgba(13,27,42,.28);overflow:hidden;user-select:none}
      .studio-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}
      .studio-element{position:absolute;box-sizing:border-box;transform-origin:center center;cursor:move;overflow:hidden}
      .studio-element.locked{cursor:not-allowed}
      .studio-element.selected{outline:2px solid #2f6fed;outline-offset:2px;z-index:999999!important}
      .studio-element .resize-handle{position:absolute;width:13px;height:13px;border:2px solid #fff;background:#2f6fed;border-radius:50%;right:-7px;bottom:-7px;cursor:nwse-resize;box-shadow:0 1px 4px rgba(0,0,0,.3)}
      .studio-element .element-label{display:none;position:absolute;left:0;top:0;background:#2f6fed;color:#fff;font-size:10px;padding:2px 6px;border-radius:0 0 6px 0;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .studio-element.selected .element-label{display:block}
      .studio-text{width:100%;height:100%;overflow:hidden;white-space:pre-wrap;display:flex;padding:4px;line-height:1.2;box-sizing:border-box}
      .studio-image{width:100%;height:100%;object-fit:contain;display:block}
      .studio-line{position:absolute;left:0;right:0;top:50%;border-top:2px solid #17365d}
      .studio-signer-preview{display:grid;width:100%;height:100%;gap:12px 34px;align-content:stretch}
      .studio-signer-cell{text-align:center;display:flex;flex-direction:column;justify-content:flex-start;min-width:0;padding:8px}
      .studio-signer-rule{border-top:1.5px solid rgba(0,0,0,.25);margin-bottom:7px}
      .studio-signer-name{font-weight:700;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .studio-signer-role{font-size:10px;text-transform:uppercase;line-height:1.15;margin-top:5px}
      .studio-logo-preview{display:grid;width:100%;height:100%;align-items:center;gap:12px;padding:6px}
      .studio-logo-preview img{width:100%;height:100%;max-height:100%;object-fit:contain}
      .studio-layers{display:flex;flex-direction:column;gap:5px;max-height:270px;overflow:auto}
      .studio-layer{display:grid;grid-template-columns:26px 1fr 28px;gap:6px;align-items:center;padding:7px 8px;border:1px solid var(--border);border-radius:9px;background:rgba(255,255,255,.035);color:var(--text);font-size:12px;cursor:pointer}
      .studio-layer.active{border-color:#4a8dff;background:rgba(47,111,237,.18)}
      .studio-layer-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .studio-layer button{border:0;background:transparent;color:var(--text);padding:2px;min-height:auto}
      .studio-property-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .studio-property-grid .span-2{grid-column:span 2}
      .studio-properties-scroll{max-height:calc(100vh - 235px);overflow:auto;padding-right:2px}
      .studio-properties .field input[type=number]{font-variant-numeric:tabular-nums}
      .studio-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
      .studio-section-title strong{font-size:13px}
      .studio-assets{display:flex;flex-direction:column;gap:6px;margin-top:8px}
      .studio-asset{display:grid;grid-template-columns:38px 1fr 30px;gap:8px;align-items:center;border:1px solid var(--border);padding:6px;border-radius:9px}
      .studio-asset img{width:38px;height:28px;object-fit:contain;background:#fff;border-radius:5px}
      .studio-status{font-size:12px;color:var(--muted);padding:0 4px}
      .studio-empty{display:flex;align-items:center;justify-content:center;height:100%;min-height:280px;text-align:center;color:var(--muted)}
      .studio-library-head{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px}
      .studio-inline-actions{display:flex;gap:6px;flex-wrap:wrap}
      .studio-template-key{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--muted)}
      .studio-help{font-size:12px;line-height:1.45;color:var(--muted)}
      .studio-token-list{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.55;background:rgba(255,255,255,.045);color:#dce7f7;border:1px solid var(--border);padding:9px;border-radius:9px}
      .studio-open-card{border-style:dashed}
      #view-home .action-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
      @media(max-width:1260px){.studio-shell{grid-template-columns:240px minmax(460px,1fr)}.studio-properties{grid-column:1/-1}.studio-properties-scroll{max-height:none}.studio-property-grid{grid-template-columns:repeat(4,1fr)}.studio-property-grid .span-2{grid-column:span 2}}
      @media(max-width:900px){.studio-shell{display:flex;flex-direction:column}.studio-canvas-viewport{min-height:480px}.studio-property-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectStudioUI() {
    injectStyles();
    const nav = document.getElementById('mainNav');
    if (nav && !nav.querySelector('[data-view="studio"]')) {
      const button = document.createElement('button');
      button.className = 'nav-item';
      button.dataset.view = 'studio';
      button.innerHTML = '<span>✦</span> Diseñar';
      nav.appendChild(button);
    }

    const existingLibraryCard = document.querySelector('#view-home [data-view-target="templates"] small');
    if (existingLibraryCard) existingLibraryCard.textContent = 'Elegí diseños integrados o plantillas creadas por vos.';

    const actionGrid = document.querySelector('#view-home .action-grid');
    if (actionGrid && !actionGrid.querySelector('[data-studio-open]')) {
      const card = document.createElement('button');
      card.className = 'action-card studio-open-card';
      card.dataset.studioOpen = 'true';
      card.innerHTML = '<span class="action-icon">✦</span><strong>Diseñar una plantilla</strong><small>Creá un fondo, ubicá campos, logos y firmantes sin modificar código.</small>';
      actionGrid.appendChild(card);
    }

    const main = document.querySelector('.main-area');
    if (main && !document.getElementById('view-studio')) {
      const section = document.createElement('section');
      section.className = 'view';
      section.id = 'view-studio';
      section.dataset.viewPanel = 'studio';
      section.innerHTML = `
        <div class="section-header">
          <div><div class="eyebrow">ESTUDIO VISUAL</div><h2>Diseñador de plantillas</h2><p>Creá diseños reutilizables con campos variables, imágenes, logos y firmantes. Todo queda guardado en esta computadora.</p></div>
          <span class="pill" id="studioTemplateCount">0 personalizadas</span>
        </div>
        <div class="studio-shell">
          <aside class="studio-sidebar">
            <div class="panel">
              <div class="studio-section-title"><strong>Documento</strong><button class="ghost-button small" id="studioNewButton">Nuevo</button></div>
              <div class="field"><label>Nombre</label><input id="studioTemplateName" maxlength="80"></div>
              <div class="field top-gap"><label>Descripción</label><textarea id="studioTemplateDescription" rows="3"></textarea></div>
              <div class="studio-property-grid top-gap">
                <label class="field">Fondo<input type="color" id="studioPageColor" value="#fffdf8"></label>
                <label class="field">Tipo predeterminado<input id="studioDefaultType" value="ASISTENCIA"></label>
              </div>
              <div class="studio-inline-actions top-gap">
                <button class="secondary-button small" id="studioUploadBackground">Subir fondo</button>
                <button class="ghost-button small" id="studioClearBackground">Quitar fondo</button>
                <input type="file" id="studioBackgroundInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>
              </div>
            </div>
            <div class="panel">
              <div class="studio-section-title"><strong>Agregar elemento</strong></div>
              <div class="studio-tool-grid">
                <button class="studio-tool secondary-button" data-add-element="text"><span>T</span>Texto</button>
                <button class="studio-tool secondary-button" data-add-element="variable"><span>{}</span>Variable</button>
                <button class="studio-tool secondary-button" data-add-element="image"><span>▧</span>Imagen</button>
                <button class="studio-tool secondary-button" data-add-element="line"><span>―</span>Línea</button>
                <button class="studio-tool secondary-button" data-add-element="rect"><span>□</span>Rectángulo</button>
                <button class="studio-tool secondary-button" data-add-element="ellipse"><span>○</span>Círculo</button>
                <button class="studio-tool secondary-button" data-add-element="signerGroup"><span>✎</span>Firmantes</button>
                <button class="studio-tool secondary-button" data-add-element="logoGroup"><span>◫</span>Logos</button>
              </div>
              <input type="file" id="studioImageInput" accept="image/*" hidden>
            </div>
            <div class="panel">
              <div class="studio-section-title"><strong>Capas</strong><span class="pill subtle" id="studioLayerCount">0</span></div>
              <div class="studio-layers" id="studioLayers"></div>
            </div>
            <div class="panel">
              <div class="studio-section-title"><strong>Biblioteca</strong></div>
              <div class="studio-inline-actions">
                <button class="secondary-button small" id="studioImportButton">Importar plantilla</button>
                <button class="ghost-button small" id="studioOpenLibraryButton">Ver guardadas</button>
                <input type="file" id="studioImportInput" accept=".diplomaker-template,.json,application/json" hidden>
              </div>
            </div>
          </aside>
          <div class="studio-center">
            <div class="studio-toolbar">
              <button class="ghost-button small" id="studioUndoButton" title="Deshacer (Ctrl+Z)">↶</button>
              <button class="ghost-button small" id="studioRedoButton" title="Rehacer (Ctrl+Shift+Z)">↷</button>
              <button class="ghost-button small" id="studioDuplicateButton" title="Duplicar (Ctrl+D)">Duplicar</button>
              <button class="ghost-button small" id="studioDeleteButton" title="Eliminar (Supr)">Eliminar</button>
              <button class="ghost-button small" id="studioBackButton" title="Enviar atrás">↓ capa</button>
              <button class="ghost-button small" id="studioFrontButton" title="Traer adelante">↑ capa</button>
              <span class="studio-spacer"></span>
              <button class="ghost-button small" id="studioZoomOutButton">−</button>
              <span class="pill subtle" id="studioZoomLabel">66%</span>
              <button class="ghost-button small" id="studioFitButton">Ajustar</button>
              <button class="ghost-button small" id="studioZoomInButton">＋</button>
              <button class="secondary-button small" id="studioExportButton">Exportar</button>
              <button class="primary-button small" id="studioSaveButton">Guardar</button>
              <button class="primary-button small" id="studioSaveUseButton">Guardar y usar</button>
            </div>
            <div class="studio-canvas-viewport" id="studioCanvasViewport">
              <div class="studio-canvas-holder" id="studioCanvasHolder"><div class="studio-canvas" id="studioCanvas"></div></div>
            </div>
            <div class="studio-status" id="studioStatus">Seleccioná un elemento para editarlo. Arrastrá para mover y usá el punto azul para redimensionar.</div>
          </div>
          <aside class="studio-properties">
            <div class="panel studio-properties-scroll">
              <div class="studio-section-title"><strong>Propiedades</strong><span class="pill subtle" id="studioSelectedType">Sin selección</span></div>
              <div id="studioProperties"><div class="studio-empty"><div><strong>Ningún elemento seleccionado</strong><p>Elegí una capa o hacé clic sobre el lienzo.</p></div></div></div>
            </div>
            <div class="panel">
              <div class="studio-section-title"><strong>Variables disponibles</strong></div>
              <div class="studio-token-list">{NOMBRE}<br>{TRATAMIENTO}<br>{NOMBRE_COMPLETO}<br>{TIPO_CERTIFICADO}<br>{EVENTO}<br>{FECHA}<br>{TEXTO}<br>{CUERPO}</div>
              <p class="studio-help">Podés escribir estos tokens dentro de cualquier texto fijo. Para lotes, la plantilla también puede seleccionarse por nombre desde la columna PLANTILLA.</p>
            </div>
          </aside>
        </div>`;
      main.appendChild(section);
    }

    const brandVersion = document.querySelector('.brand-version');
    if (brandVersion) brandVersion.textContent = '2.1 · Estudio de plantillas';

    const helpDialog = document.getElementById('helpDialog');
    if (helpDialog) {
      const steps = helpDialog.querySelector('.help-steps');
      if (steps && !steps.querySelector('[data-studio-help-step]')) {
        const item = document.createElement('li');
        item.dataset.studioHelpStep = 'true';
        item.textContent = 'Usá Diseñar para crear, importar o exportar plantillas personalizadas.';
        steps.appendChild(item);
      }
      const meta = helpDialog.querySelector('.muted-text');
      if (meta) meta.textContent = 'Diplomaker 2.1 · Estudio de plantillas · 24/08/2026 · Ariel Marcelo Gómez';
    }

    const templatesView = document.getElementById('view-templates');
    if (templatesView) {
      const heading = templatesView.querySelector('.section-header h2');
      const paragraph = templatesView.querySelector('.section-header p');
      const badge = templatesView.querySelector('.section-header .pill');
      if (heading) heading.textContent = 'Biblioteca de plantillas';
      if (paragraph) paragraph.textContent = 'Diseños integrados y plantillas personalizadas creadas en esta computadora.';
      if (badge) badge.id = 'templateLibraryCount';
      const roadmap = templatesView.querySelector('.roadmap-panel');
      if (roadmap) roadmap.innerHTML = '<div><div class="eyebrow">CREACIÓN SIN CÓDIGO</div><h3>Estudio visual de plantillas</h3><p>Subí un fondo, arrastrá campos, agregá logos y firmantes, y exportá el diseño para usarlo en otra computadora.</p></div><button class="primary-button" data-studio-open>Diseñar plantilla</button>';
    }
  }

  function showStudio() {
    document.querySelectorAll('[data-view-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === 'studio'));
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === 'studio'));
    const eyebrow = document.getElementById('viewEyebrow');
    const title = document.getElementById('viewTitle');
    if (eyebrow) eyebrow.textContent = 'DISEÑO';
    if (title) title.textContent = 'Estudio visual de plantillas';
    renderStudio();
    setTimeout(fitCanvas, 20);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindStudioNavigation() {
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-view="studio"],[data-studio-open]');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showStudio();
    }, true);
  }

  function markStudioDirty() {
    state.isDirty = true;
    const status = document.getElementById('studioStatus');
    if (status) status.textContent = 'Cambios sin guardar.';
  }

  function pushHistory() {
    if (!state.draft) return;
    const snapshot = JSON.stringify(state.draft.customDefinition);
    if (state.history[state.historyIndex] === snapshot) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    if (state.history.length > 80) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoButtons();
  }

  function restoreHistory(index) {
    if (index < 0 || index >= state.history.length) return;
    state.historyIndex = index;
    state.draft.customDefinition = JSON.parse(state.history[index]);
    if (!state.draft.customDefinition.elements.some(element => element.id === state.selectedElementId)) state.selectedElementId = null;
    markStudioDirty();
    renderStudio();
    updateUndoButtons();
  }

  function undo() {
    restoreHistory(state.historyIndex - 1);
  }

  function redo() {
    restoreHistory(state.historyIndex + 1);
  }

  function updateUndoButtons() {
    const undoButton = document.getElementById('studioUndoButton');
    const redoButton = document.getElementById('studioRedoButton');
    if (undoButton) undoButton.disabled = state.historyIndex <= 0;
    if (redoButton) redoButton.disabled = state.historyIndex >= state.history.length - 1;
  }

  function newStudioTemplate() {
    if (state.isDirty && !window.confirm('Hay cambios sin guardar. ¿Crear igualmente una plantilla nueva?')) return;
    state.draft = defaultTemplateDefinition();
    state.selectedElementId = state.draft.customDefinition.elements[0]?.id || null;
    state.history = [];
    state.historyIndex = -1;
    state.isDirty = false;
    state.lastSavedId = null;
    pushHistory();
    renderStudio();
    fitCanvas();
  }

  function openStudioTemplate(id) {
    const template = TL.templates.find(item => item.id === id && item.custom);
    if (!template) return;
    if (state.isDirty && !window.confirm('Hay cambios sin guardar. ¿Abrir otra plantilla igualmente?')) return;
    state.draft = sanitizeTemplate(template);
    state.selectedElementId = state.draft.customDefinition.elements[0]?.id || null;
    state.history = [];
    state.historyIndex = -1;
    state.isDirty = false;
    state.lastSavedId = template.id;
    pushHistory();
    showStudio();
  }

  function selectedElement() {
    return state.draft?.customDefinition?.elements?.find(element => element.id === state.selectedElementId) || null;
  }

  function elementSampleText(element) {
    if (element.field) {
      return resolveField(element.field, SAMPLE_RECORD, state.draft || defaultTemplateDefinition());
    }
    return replaceTokens(element.text, SAMPLE_RECORD, state.draft || defaultTemplateDefinition());
  }

  function renderDOMText(element) {
    const text = elementSampleText(element);
    const style = [
      `font-family:${element.fontFamily || 'Arial'}`,
      `font-size:${Number(element.fontSize || 20)}px`,
      `font-weight:${Number(element.fontWeight || 400)}`,
      `font-style:${element.italic ? 'italic' : 'normal'}`,
      `text-decoration:${element.underline ? 'underline' : 'none'}`,
      `color:${element.color || '#111'}`,
      `text-align:${element.align || 'left'}`,
      `justify-content:${element.align === 'center' ? 'center' : element.align === 'right' ? 'flex-end' : 'flex-start'}`,
      `align-items:${element.valign === 'middle' ? 'center' : element.valign === 'bottom' ? 'flex-end' : 'flex-start'}`,
      `line-height:${Number(element.lineHeight || 1.2)}`,
      `letter-spacing:${Number(element.letterSpacing || 0)}px`,
      `text-transform:${element.uppercase ? 'uppercase' : 'none'}`,
      `background:${element.backgroundColor || 'transparent'}`,
      `border:${Number(element.borderWidth || 0)}px solid ${element.borderColor || 'transparent'}`,
      `border-radius:${Number(element.borderRadius || 0)}px`,
      `padding:${Number(element.padding || 0)}px`
    ].join(';');
    return `<div class="studio-text" style="${style}">${escape(text).replace(/\n/g, '<br>')}</div>`;
  }

  function renderDOMSignerGroup(element) {
    const signers = SAMPLE_RECORD.signers.slice(0, Number(element.maxSigners || 8));
    const columns = Math.max(1, Math.min(Number(element.columns || 2), signers.length));
    return `<div class="studio-signer-preview" style="grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${Number(element.gapY || 12)}px ${Number(element.gapX || 34)}px;color:${element.textColor || '#222'}">${signers.map(signer => `<div class="studio-signer-cell">${element.showLine === false ? '' : `<div class="studio-signer-rule" style="border-color:${element.lineColor || 'rgba(0,0,0,.25)'}"></div>`}<div class="studio-signer-name" style="font-family:${element.nameFontFamily || 'Arial'};font-size:${Number(element.nameFontSize || 18)}px">${escape(signer.name)}</div><div class="studio-signer-role" style="font-family:${element.roleFontFamily || 'Arial'};font-size:${Number(element.roleFontSize || 10)}px;text-transform:${element.roleUppercase === false ? 'none' : 'uppercase'}">${escape(signer.role)}</div></div>`).join('')}</div>`;
  }

  function renderDOMLogoGroup(element) {
    const assets = Array.isArray(element.assets) ? element.assets : [];
    const columns = Math.max(1, Math.min(Number(element.columns || Math.max(1, assets.length)), Math.max(1, assets.length)));
    if (!assets.length) return '<div class="studio-empty"><div>Subí logos desde Propiedades.</div></div>';
    return `<div class="studio-logo-preview" style="grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${Number(element.gap || 16)}px;padding:${Number(element.padding || 6)}px">${assets.map(asset => `<img src="${asset.src}" alt="${escape(asset.name || 'Logo')}">`).join('')}</div>`;
  }

  function renderDOMElement(element) {
    let body = '';
    if (element.type === 'text') body = renderDOMText(element);
    else if (element.type === 'image') body = element.src ? `<img class="studio-image" src="${element.src}" style="object-fit:${element.fit || 'contain'};border-radius:${Number(element.borderRadius || 0)}px;background:${element.backgroundColor || 'transparent'}">` : '<div class="studio-empty"><div>Imagen</div></div>';
    else if (element.type === 'line') body = `<div class="studio-line" style="border-color:${element.color || '#17365d'};border-width:${Number(element.lineWidth || 2)}px;border-style:${element.dash === 'dashed' ? 'dashed' : element.dash === 'dotted' ? 'dotted' : 'solid'}"></div>`;
    else if (element.type === 'rect') body = `<div style="width:100%;height:100%;background:${element.fill || 'transparent'};border:${Number(element.lineWidth || 2)}px solid ${element.stroke || '#17365d'};border-radius:${Number(element.borderRadius || 0)}px"></div>`;
    else if (element.type === 'ellipse') body = `<div style="width:100%;height:100%;background:${element.fill || 'transparent'};border:${Number(element.lineWidth || 2)}px solid ${element.stroke || '#17365d'};border-radius:50%"></div>`;
    else if (element.type === 'signerGroup') body = renderDOMSignerGroup(element);
    else if (element.type === 'logoGroup') body = renderDOMLogoGroup(element);
    const selected = element.id === state.selectedElementId;
    return `<div class="studio-element ${selected ? 'selected' : ''} ${element.locked ? 'locked' : ''}" data-element-id="${element.id}" style="left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;opacity:${element.opacity ?? 1};transform:rotate(${Number(element.rotation || 0)}deg);z-index:${Number(element.z || 0)};display:${element.visible === false ? 'none' : 'block'}"><span class="element-label">${escape(element.name || element.type)}</span>${body}${selected && !element.locked ? '<span class="resize-handle" data-resize-handle></span>' : ''}</div>`;
  }

  function renderCanvas() {
    const canvas = document.getElementById('studioCanvas');
    const holder = document.getElementById('studioCanvasHolder');
    if (!canvas || !holder || !state.draft) return;
    const definition = state.draft.customDefinition;
    const page = definition.page;
    holder.style.width = `${BASE_WIDTH * state.zoom}px`;
    holder.style.height = `${BASE_HEIGHT * state.zoom}px`;
    canvas.style.transform = `scale(${state.zoom})`;
    canvas.style.transformOrigin = 'top left';
    canvas.style.backgroundColor = page.backgroundColor || '#fff';
    const background = page.backgroundData ? `<img class="studio-bg" src="${page.backgroundData}" alt="">` : '';
    canvas.innerHTML = background + [...definition.elements].sort((a, b) => Number(a.z || 0) - Number(b.z || 0)).map(renderDOMElement).join('');
    canvas.querySelectorAll('[data-element-id]').forEach(node => node.addEventListener('pointerdown', startElementPointer));
    document.getElementById('studioZoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function renderLayers() {
    const container = document.getElementById('studioLayers');
    if (!container || !state.draft) return;
    const elements = [...state.draft.customDefinition.elements].sort((a, b) => Number(b.z || 0) - Number(a.z || 0));
    container.innerHTML = elements.map(element => `<div class="studio-layer ${element.id === state.selectedElementId ? 'active' : ''}" data-layer-id="${element.id}"><button type="button" data-layer-visible="${element.id}" title="Mostrar u ocultar">${element.visible === false ? '○' : '●'}</button><span class="studio-layer-name">${escape(element.name || element.type)}</span><button type="button" data-layer-lock="${element.id}" title="Bloquear o desbloquear">${element.locked ? '🔒' : '🔓'}</button></div>`).join('');
    document.getElementById('studioLayerCount').textContent = String(elements.length);
    container.querySelectorAll('[data-layer-id]').forEach(row => row.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      state.selectedElementId = row.dataset.layerId;
      renderCanvas();
      renderLayers();
      renderProperties();
    }));
    container.querySelectorAll('[data-layer-visible]').forEach(button => button.addEventListener('click', () => {
      const element = state.draft.customDefinition.elements.find(item => item.id === button.dataset.layerVisible);
      if (!element) return;
      element.visible = element.visible === false;
      pushHistory(); markStudioDirty(); renderStudio();
    }));
    container.querySelectorAll('[data-layer-lock]').forEach(button => button.addEventListener('click', () => {
      const element = state.draft.customDefinition.elements.find(item => item.id === button.dataset.layerLock);
      if (!element) return;
      element.locked = !element.locked;
      pushHistory(); markStudioDirty(); renderStudio();
    }));
  }

  function commonPropertyHTML(element) {
    return `<div class="studio-property-grid">
      <label class="field span-2">Nombre de capa<input data-prop="name" value="${escape(element.name || '')}"></label>
      <label class="field">X<input type="number" data-prop-number="x" value="${Math.round(element.x)}"></label>
      <label class="field">Y<input type="number" data-prop-number="y" value="${Math.round(element.y)}"></label>
      <label class="field">Ancho<input type="number" min="1" data-prop-number="width" value="${Math.round(element.width)}"></label>
      <label class="field">Alto<input type="number" min="1" data-prop-number="height" value="${Math.round(element.height)}"></label>
      <label class="field">Rotación<input type="number" min="-180" max="180" data-prop-number="rotation" value="${Number(element.rotation || 0)}"></label>
      <label class="field">Opacidad<input type="number" min="0" max="1" step="0.05" data-prop-number="opacity" value="${Number(element.opacity ?? 1)}"></label>
    </div>`;
  }

  function textPropertyHTML(element) {
    return `${element.field ? `<label class="field top-gap">Campo variable<select data-prop="field">${FIELD_OPTIONS.map(option => `<option value="${option.value}" ${option.value === element.field ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}</select></label>` : `<label class="field top-gap">Contenido<textarea rows="4" data-prop="text">${escape(element.text || '')}</textarea></label>`}
      <div class="studio-property-grid top-gap">
        <label class="field span-2">Tipografía<select data-prop="fontFamily">${FONT_OPTIONS.map(font => `<option ${font === element.fontFamily ? 'selected' : ''}>${font}</option>`).join('')}</select></label>
        <label class="field">Tamaño<input type="number" min="6" max="220" data-prop-number="fontSize" value="${Number(element.fontSize || 20)}"></label>
        <label class="field">Mínimo<input type="number" min="6" max="220" data-prop-number="minFontSize" value="${Number(element.minFontSize || 10)}"></label>
        <label class="field">Peso<select data-prop-number="fontWeight"><option value="300" ${Number(element.fontWeight) === 300 ? 'selected' : ''}>Liviano</option><option value="400" ${Number(element.fontWeight) === 400 ? 'selected' : ''}>Normal</option><option value="600" ${Number(element.fontWeight) === 600 ? 'selected' : ''}>Seminegrita</option><option value="700" ${Number(element.fontWeight) === 700 ? 'selected' : ''}>Negrita</option><option value="800" ${Number(element.fontWeight) === 800 ? 'selected' : ''}>Extra negrita</option></select></label>
        <label class="field">Color<input type="color" data-prop="color" value="${colorInputValue(element.color, '#111111')}"></label>
        <label class="field">Alineación<select data-prop="align"><option value="left" ${element.align === 'left' ? 'selected' : ''}>Izquierda</option><option value="center" ${element.align === 'center' ? 'selected' : ''}>Centro</option><option value="right" ${element.align === 'right' ? 'selected' : ''}>Derecha</option></select></label>
        <label class="field">Vertical<select data-prop="valign"><option value="top" ${element.valign === 'top' ? 'selected' : ''}>Arriba</option><option value="middle" ${element.valign === 'middle' ? 'selected' : ''}>Centro</option><option value="bottom" ${element.valign === 'bottom' ? 'selected' : ''}>Abajo</option></select></label>
        <label class="field">Interlineado<input type="number" min="0.8" max="3" step="0.05" data-prop-number="lineHeight" value="${Number(element.lineHeight || 1.2)}"></label>
        <label class="field">Espaciado<input type="number" min="-4" max="30" step="0.5" data-prop-number="letterSpacing" value="${Number(element.letterSpacing || 0)}"></label>
        <label class="field">Fondo<input type="color" data-prop="backgroundColor" data-transparent-value value="${colorInputValue(element.backgroundColor, '#ffffff')}"></label>
        <label class="field">Borde<input type="color" data-prop="borderColor" data-transparent-value value="${colorInputValue(element.borderColor, '#000000')}"></label>
        <label class="field">Grosor borde<input type="number" min="0" max="20" step="1" data-prop-number="borderWidth" value="${Number(element.borderWidth || 0)}"></label>
        <label class="field">Radio<input type="number" min="0" max="100" data-prop-number="borderRadius" value="${Number(element.borderRadius || 0)}"></label>
        <label class="field">Margen<input type="number" min="0" max="80" data-prop-number="padding" value="${Number(element.padding || 0)}"></label>
      </div>
      <div class="studio-inline-actions top-gap">
        <label><input type="checkbox" data-prop-bool="italic" ${element.italic ? 'checked' : ''}> Cursiva</label>
        <label><input type="checkbox" data-prop-bool="underline" ${element.underline ? 'checked' : ''}> Subrayado</label>
        <label><input type="checkbox" data-prop-bool="uppercase" ${element.uppercase ? 'checked' : ''}> Mayúsculas</label>
        <label><input type="checkbox" data-prop-bool="autoFit" ${element.autoFit !== false ? 'checked' : ''}> Ajuste automático</label>
      </div>`;
  }

  function colorInputValue(value, fallback) {
    const raw = String(value || '');
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
  }

  function imagePropertyHTML(element) {
    return `<div class="studio-inline-actions top-gap"><button class="secondary-button small" id="studioReplaceImageButton">${element.src ? 'Reemplazar imagen' : 'Subir imagen'}</button><button class="ghost-button small" id="studioClearImageButton">Quitar</button></div><label class="field top-gap">Ajuste<select data-prop="fit"><option value="contain" ${element.fit === 'contain' ? 'selected' : ''}>Contener</option><option value="cover" ${element.fit === 'cover' ? 'selected' : ''}>Cubrir</option><option value="stretch" ${element.fit === 'stretch' ? 'selected' : ''}>Estirar</option></select></label><div class="studio-property-grid top-gap"><label class="field">Radio<input type="number" min="0" max="100" data-prop-number="borderRadius" value="${Number(element.borderRadius || 0)}"></label><label class="field">Fondo<input type="color" data-prop="backgroundColor" value="${colorInputValue(element.backgroundColor, '#ffffff')}"></label></div>`;
  }

  function shapePropertyHTML(element) {
    if (element.type === 'line') return `<div class="studio-property-grid top-gap"><label class="field">Color<input type="color" data-prop="color" value="${colorInputValue(element.color, '#17365d')}"></label><label class="field">Grosor<input type="number" min="1" max="30" data-prop-number="lineWidth" value="${Number(element.lineWidth || 2)}"></label><label class="field span-2">Estilo<select data-prop="dash"><option value="solid" ${element.dash === 'solid' ? 'selected' : ''}>Continua</option><option value="dashed" ${element.dash === 'dashed' ? 'selected' : ''}>Guiones</option><option value="dotted" ${element.dash === 'dotted' ? 'selected' : ''}>Puntos</option></select></label></div>`;
    return `<div class="studio-property-grid top-gap"><label class="field">Relleno<input type="color" data-prop="fill" value="${colorInputValue(element.fill, '#ffffff')}"></label><label class="field">Borde<input type="color" data-prop="stroke" value="${colorInputValue(element.stroke, '#17365d')}"></label><label class="field">Grosor<input type="number" min="0" max="30" data-prop-number="lineWidth" value="${Number(element.lineWidth || 2)}"></label>${element.type === 'rect' ? `<label class="field">Radio<input type="number" min="0" max="100" data-prop-number="borderRadius" value="${Number(element.borderRadius || 0)}"></label>` : ''}</div>`;
  }

  function signerPropertyHTML(element) {
    return `<div class="studio-property-grid top-gap"><label class="field">Columnas<input type="number" min="1" max="4" data-prop-number="columns" value="${Number(element.columns || 2)}"></label><label class="field">Máximo<input type="number" min="1" max="12" data-prop-number="maxSigners" value="${Number(element.maxSigners || 8)}"></label><label class="field">Color texto<input type="color" data-prop="textColor" value="${colorInputValue(element.textColor, '#24364f')}"></label><label class="field">Color línea<input type="color" data-prop="lineColor" value="${colorInputValue(element.lineColor, '#808080')}"></label><label class="field">Nombre tamaño<input type="number" min="8" max="50" data-prop-number="nameFontSize" value="${Number(element.nameFontSize || 18)}"></label><label class="field">Cargo tamaño<input type="number" min="6" max="30" data-prop-number="roleFontSize" value="${Number(element.roleFontSize || 10)}"></label><label class="field">Separación X<input type="number" min="0" max="120" data-prop-number="gapX" value="${Number(element.gapX || 34)}"></label><label class="field">Separación Y<input type="number" min="0" max="120" data-prop-number="gapY" value="${Number(element.gapY || 12)}"></label><label class="field span-2">Fuente nombre<select data-prop="nameFontFamily">${FONT_OPTIONS.map(font => `<option ${font === element.nameFontFamily ? 'selected' : ''}>${font}</option>`).join('')}</select></label><label class="field span-2">Fuente cargo<select data-prop="roleFontFamily">${FONT_OPTIONS.map(font => `<option ${font === element.roleFontFamily ? 'selected' : ''}>${font}</option>`).join('')}</select></label></div><div class="studio-inline-actions top-gap"><label><input type="checkbox" data-prop-bool="showLine" ${element.showLine !== false ? 'checked' : ''}> Línea de firma</label><label><input type="checkbox" data-prop-bool="roleUppercase" ${element.roleUppercase !== false ? 'checked' : ''}> Cargo en mayúsculas</label></div>`;
  }

  function logoPropertyHTML(element) {
    const assets = Array.isArray(element.assets) ? element.assets : [];
    return `<div class="studio-property-grid top-gap"><label class="field">Columnas<input type="number" min="1" max="12" data-prop-number="columns" value="${Number(element.columns || 6)}"></label><label class="field">Separación<input type="number" min="0" max="100" data-prop-number="gap" value="${Number(element.gap || 20)}"></label><label class="field">Margen<input type="number" min="0" max="80" data-prop-number="padding" value="${Number(element.padding || 8)}"></label></div><div class="studio-inline-actions top-gap"><button class="secondary-button small" id="studioAddLogosButton">Agregar logos</button><input type="file" id="studioLogosInput" accept="image/*" multiple hidden></div><div class="studio-assets">${assets.map(asset => `<div class="studio-asset" data-asset-id="${asset.id}"><img src="${asset.src}" alt=""><span>${escape(asset.name || 'Logo')}</span><button type="button" data-remove-asset="${asset.id}">×</button></div>`).join('')}</div>`;
  }

  function renderProperties() {
    const container = document.getElementById('studioProperties');
    const typeBadge = document.getElementById('studioSelectedType');
    if (!container || !state.draft) return;
    const element = selectedElement();
    if (!element) {
      typeBadge.textContent = 'Sin selección';
      container.innerHTML = '<div class="studio-empty"><div><strong>Ningún elemento seleccionado</strong><p>Elegí una capa o hacé clic sobre el lienzo.</p></div></div>';
      return;
    }
    typeBadge.textContent = element.type;
    let specific = '';
    if (element.type === 'text') specific = textPropertyHTML(element);
    else if (element.type === 'image') specific = imagePropertyHTML(element);
    else if (['line', 'rect', 'ellipse'].includes(element.type)) specific = shapePropertyHTML(element);
    else if (element.type === 'signerGroup') specific = signerPropertyHTML(element);
    else if (element.type === 'logoGroup') specific = logoPropertyHTML(element);
    container.innerHTML = commonPropertyHTML(element) + specific;
    bindPropertyEvents();
  }

  function bindPropertyEvents() {
    const container = document.getElementById('studioProperties');
    const element = selectedElement();
    if (!container || !element) return;
    const update = (key, value) => {
      element[key] = value;
      markStudioDirty();
      queueCanvasRender();
      if (key === 'name') renderLayers();
    };
    container.querySelectorAll('[data-prop]').forEach(input => input.addEventListener('input', () => update(input.dataset.prop, input.value)));
    container.querySelectorAll('[data-prop-number]').forEach(input => input.addEventListener('input', () => update(input.dataset.propNumber, Number(input.value || 0))));
    container.querySelectorAll('[data-prop-bool]').forEach(input => input.addEventListener('change', () => update(input.dataset.propBool, input.checked)));
    container.querySelectorAll('input,select,textarea').forEach(input => input.addEventListener('change', pushHistory));

    document.getElementById('studioReplaceImageButton')?.addEventListener('click', () => {
      const fileInput = document.getElementById('studioImageInput');
      fileInput.dataset.targetElementId = element.id;
      fileInput.click();
    });
    document.getElementById('studioClearImageButton')?.addEventListener('click', () => {
      element.src = '';
      pushHistory(); markStudioDirty(); renderStudio();
    });
    document.getElementById('studioAddLogosButton')?.addEventListener('click', () => document.getElementById('studioLogosInput').click());
    document.getElementById('studioLogosInput')?.addEventListener('change', async event => {
      const files = [...(event.target.files || [])];
      if (!files.length) return;
      element.assets = Array.isArray(element.assets) ? element.assets : [];
      let added = 0;
      try {
        for (const file of files.slice(0, 48 - element.assets.length)) {
          element.assets.push({ id: U.uuid('asset'), name: file.name.replace(/\.[^.]+$/, ''), src: await dataURLFromFile(file) });
          added++;
        }
        element.columns = Math.min(8, Math.max(1, element.assets.length));
        if (added) { pushHistory(); markStudioDirty(); renderStudio(); }
      } catch (error) {
        studioToast(error.message || 'No se pudieron cargar todos los logos.', 'error');
        if (added) { pushHistory(); markStudioDirty(); renderStudio(); }
      } finally {
        event.target.value = '';
      }
    });
    container.querySelectorAll('[data-remove-asset]').forEach(button => button.addEventListener('click', () => {
      element.assets = (element.assets || []).filter(asset => asset.id !== button.dataset.removeAsset);
      pushHistory(); markStudioDirty(); renderStudio();
    }));
  }

  function queueCanvasRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      renderCanvas();
    });
  }

  function renderDocumentFields() {
    if (!state.draft) return;
    const name = document.getElementById('studioTemplateName');
    const description = document.getElementById('studioTemplateDescription');
    const pageColor = document.getElementById('studioPageColor');
    const defaultType = document.getElementById('studioDefaultType');
    if (name && name !== document.activeElement) name.value = state.draft.name || '';
    if (description && description !== document.activeElement) description.value = state.draft.description || '';
    if (pageColor && pageColor !== document.activeElement) pageColor.value = colorInputValue(state.draft.customDefinition.page.backgroundColor, '#ffffff');
    if (defaultType && defaultType !== document.activeElement) defaultType.value = state.draft.defaultType || 'ASISTENCIA';
  }

  function renderStudio() {
    if (!state.draft) state.draft = defaultTemplateDefinition();
    renderDocumentFields();
    renderCanvas();
    renderLayers();
    renderProperties();
    updateUndoButtons();
    updateTemplateCounters();
  }

  function selectElement(id) {
    state.selectedElementId = id;
    renderCanvas();
    renderLayers();
    renderProperties();
  }

  function canvasCoordinates(event) {
    const canvas = document.getElementById('studioCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / state.zoom,
      y: (event.clientY - rect.top) / state.zoom
    };
  }

  function startElementPointer(event) {
    const node = event.currentTarget;
    const element = state.draft.customDefinition.elements.find(item => item.id === node.dataset.elementId);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(element.id);
    if (element.locked) return;
    const point = canvasCoordinates(event);
    state.pointer = {
      id: element.id,
      mode: event.target.closest('[data-resize-handle]') ? 'resize' : 'move',
      startX: point.x,
      startY: point.y,
      originalX: element.x,
      originalY: element.y,
      originalWidth: element.width,
      originalHeight: element.height
    };
    window.addEventListener('pointermove', moveElementPointer);
    window.addEventListener('pointerup', endElementPointer, { once: true });
  }

  function snap(value, event) {
    if (event.altKey) return value;
    return Math.round(value / 5) * 5;
  }

  function moveElementPointer(event) {
    if (!state.pointer) return;
    const element = state.draft.customDefinition.elements.find(item => item.id === state.pointer.id);
    if (!element) return;
    const point = canvasCoordinates(event);
    const dx = point.x - state.pointer.startX;
    const dy = point.y - state.pointer.startY;
    if (state.pointer.mode === 'move') {
      element.x = U.clamp(snap(state.pointer.originalX + dx, event), -element.width + 15, BASE_WIDTH - 15);
      element.y = U.clamp(snap(state.pointer.originalY + dy, event), -element.height + 15, BASE_HEIGHT - 15);
    } else {
      element.width = U.clamp(snap(state.pointer.originalWidth + dx, event), 20, BASE_WIDTH - element.x + 300);
      element.height = U.clamp(snap(state.pointer.originalHeight + dy, event), 20, BASE_HEIGHT - element.y + 300);
    }
    markStudioDirty();
    renderCanvas();
    renderProperties();
  }

  function endElementPointer() {
    window.removeEventListener('pointermove', moveElementPointer);
    if (state.pointer) pushHistory();
    state.pointer = null;
  }

  function addElement(type) {
    let element;
    if (type === 'variable') element = createElement('text', { name: 'Nombre del participante', field: 'participantName', text: '', x: 150, y: 300, width: 820, height: 80, fontFamily: 'Georgia', fontSize: 48, minFontSize: 20, fontWeight: 700, color: '#1e2d42', align: 'center', valign: 'middle' });
    else element = createElement(type);
    state.draft.customDefinition.elements.push(element);
    state.selectedElementId = element.id;
    pushHistory(); markStudioDirty(); renderStudio();
    if (type === 'image') {
      const input = document.getElementById('studioImageInput');
      input.dataset.targetElementId = element.id;
      input.click();
    }
  }

  function duplicateSelected() {
    const element = selectedElement();
    if (!element) return;
    const copy = U.deepClone(element);
    copy.id = U.uuid('element');
    copy.name = `${element.name || 'Elemento'} copia`;
    copy.x += 18;
    copy.y += 18;
    copy.z = Math.max(...state.draft.customDefinition.elements.map(item => Number(item.z || 0)), 0) + 1;
    state.draft.customDefinition.elements.push(copy);
    state.selectedElementId = copy.id;
    pushHistory(); markStudioDirty(); renderStudio();
  }

  function deleteSelected() {
    if (!state.selectedElementId) return;
    state.draft.customDefinition.elements = state.draft.customDefinition.elements.filter(element => element.id !== state.selectedElementId);
    state.selectedElementId = state.draft.customDefinition.elements[0]?.id || null;
    pushHistory(); markStudioDirty(); renderStudio();
  }

  function changeLayer(delta) {
    const element = selectedElement();
    if (!element) return;
    const values = state.draft.customDefinition.elements.map(item => Number(item.z || 0));
    if (delta > 0) element.z = Math.max(...values, 0) + 1;
    else element.z = Math.min(...values, 0) - 1;
    pushHistory(); markStudioDirty(); renderStudio();
  }

  function moveSelectedBy(dx, dy) {
    const element = selectedElement();
    if (!element || element.locked) return;
    element.x = U.clamp(element.x + dx, -element.width + 15, BASE_WIDTH - 15);
    element.y = U.clamp(element.y + dy, -element.height + 15, BASE_HEIGHT - 15);
    pushHistory(); markStudioDirty(); renderCanvas(); renderProperties();
  }

  function fitCanvas() {
    const viewport = document.getElementById('studioCanvasViewport');
    if (!viewport) return;
    const width = Math.max(420, viewport.clientWidth - 68);
    const height = Math.max(360, viewport.clientHeight - 68);
    state.zoom = U.clamp(Math.min(width / BASE_WIDTH, height / BASE_HEIGHT), .25, 1.2);
    renderCanvas();
  }

  function updateTemplateCounters() {
    const customCount = customTemplates().length;
    const total = TL.templates.length;
    const studioCount = document.getElementById('studioTemplateCount');
    const libraryCount = document.getElementById('templateLibraryCount');
    if (studioCount) studioCount.textContent = `${customCount} personalizada${customCount === 1 ? '' : 's'}`;
    if (libraryCount) libraryCount.textContent = `${total} plantilla${total === 1 ? '' : 's'}`;
  }

  async function saveDraft(useAfter = false) {
    if (!state.draft) return;
    const name = U.normalizeText(document.getElementById('studioTemplateName')?.value || state.draft.name);
    if (!name) {
      studioToast('Ingresá un nombre para la plantilla.', 'error');
      return;
    }
    state.draft.name = name;
    state.draft.shortName = name;
    state.draft.description = U.normalizeText(document.getElementById('studioTemplateDescription')?.value || state.draft.description);
    state.draft.defaultType = U.normalizeText(document.getElementById('studioDefaultType')?.value || 'ASISTENCIA').toLocaleUpperCase('es-AR');
    state.draft.updatedAt = new Date().toISOString();
    state.draft.background = state.draft.customDefinition.page.backgroundData || blankBackgroundData(state.draft.customDefinition.page.backgroundColor, '#17365d');
    const clean = sanitizeTemplate(state.draft);
    await saveStoredTemplate(clean);
    registerTemplate(clean);
    state.draft = U.deepClone(clean);
    state.lastSavedId = clean.id;
    state.isDirty = false;
    updateTemplateCounters();
    studioToast('Plantilla guardada en la biblioteca local.', 'success');
    if (useAfter) {
      const libraryNav = document.querySelector('[data-view="templates"]');
      libraryNav?.click();
      setTimeout(() => document.querySelector(`#templateLibrary [data-template-id="${CSS.escape(clean.id)}"]`)?.click(), 30);
    } else renderStudio();
  }

  function exportDraft() {
    if (!state.draft) return;
    const clean = sanitizeTemplate(state.draft);
    const payload = {
      format: TEMPLATE_FORMAT,
      version: STUDIO_VERSION,
      exportedAt: new Date().toISOString(),
      template: clean
    };
    U.downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${U.slugify(clean.name)}.diplomaker-template`);
    studioToast('Plantilla exportada.', 'success');
  }

  function legacyColumnToField(column) {
    const key = U.normalizeHeader(column);
    const map = {
      NOMBRE_APELLIDO: 'participantName',
      TRATAMIENTO: 'treatment',
      TIPO_CERTIFICADO: 'certificateType',
      EVENTO_Y_FECHA: 'eventTitle',
      EVENTO: 'eventTitle',
      FECHA: 'eventDate',
      TEXTO_CERTIFICADO: 'eventText'
    };
    return map[key] || '';
  }

  function migrateLegacyTemplate(raw, index = 0) {
    const base = defaultTemplateDefinition();
    base.id = U.uuid('custom');
    base.name = U.normalizeText(raw.name || `Plantilla importada ${index + 1}`);
    base.shortName = base.name;
    base.description = 'Plantilla migrada desde Creador de Certificados 1.4.';
    base.customDefinition.page.backgroundData = raw.bgData || '';
    base.customDefinition.elements = [];
    (raw.fields || []).forEach((field, fieldIndex) => {
      const sourceField = field.sourceType === 'column' ? legacyColumnToField(field.column) : '';
      base.customDefinition.elements.push(createElement('text', {
        name: field.label || `Campo ${fieldIndex + 1}`,
        field: sourceField,
        text: sourceField ? '' : field.fixedText || '',
        x: Number(field.xPct || 50) / 100 * BASE_WIDTH - Number(field.widthPct || 80) / 200 * BASE_WIDTH,
        y: Number(field.yPct || 45) / 100 * BASE_HEIGHT - 35,
        width: Number(field.widthPct || 80) / 100 * BASE_WIDTH,
        height: Math.max(56, Number(field.fontSize || 22) * 2.8),
        fontSize: Number(field.fontSize || 22),
        fontWeight: field.bold ? 700 : 400,
        italic: !!field.italic,
        color: field.color || '#111111',
        fontFamily: field.fontFamily || 'Arial',
        align: field.align || 'center',
        letterSpacing: Number(field.letterSpacing || 0),
        lineHeight: Number(field.lineHeight || 1.2)
      }));
    });
    if (raw.showSigners) base.customDefinition.elements.push(createElement('signerGroup', {
      maxSigners: Number(raw.signerCount || 4),
      columns: Math.min(2, Number(raw.signerCount || 4)),
      y: BASE_HEIGHT - (Number(raw.signersBottomPct || 12) / 100 * BASE_HEIGHT) - 135
    }));
    return sanitizeTemplate(base);
  }

  async function importTemplateFile(file) {
    const raw = await U.readAsText(file);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      throw new Error('El archivo no contiene JSON válido.');
    }
    let imported = [];
    if (Array.isArray(parsed)) imported = parsed.map(migrateLegacyTemplate);
    else if (parsed.format === TEMPLATE_FORMAT && parsed.template) imported = [sanitizeTemplate(parsed.template)];
    else if (parsed.customDefinition || parsed.definition || parsed.page) imported = [sanitizeTemplate(parsed)];
    else throw new Error('El archivo no corresponde a una plantilla Diplomaker compatible.');

    for (const template of imported) {
      if (BUILTIN_IDS.has(template.id)) template.id = U.uuid('custom');
      await saveStoredTemplate(template);
      registerTemplate(template);
    }
    updateTemplateCounters();
    studioToast(`${imported.length} plantilla${imported.length === 1 ? '' : 's'} importada${imported.length === 1 ? '' : 's'}.`, 'success');
    openStudioTemplate(imported[0].id);
  }

  function showTemplateLibraryDialog() {
    let dialog = document.getElementById('studioLibraryDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'studioLibraryDialog';
      dialog.className = 'modal edit-modal';
      dialog.innerHTML = '<div class="modal-header"><h2>Plantillas personalizadas</h2><button class="icon-button" data-close-studio-library>×</button></div><div class="modal-body" id="studioLibraryBody"></div>';
      document.body.appendChild(dialog);
      dialog.querySelector('[data-close-studio-library]').addEventListener('click', () => dialog.close());
    }
    const body = dialog.querySelector('#studioLibraryBody');
    const templates = customTemplates();
    body.innerHTML = templates.length ? `<div class="template-library">${templates.map(template => `<article class="template-library-card"><div class="template-library-preview" style="background-image:url('${template.background}')"></div><div class="template-library-body"><div><strong>${escape(template.shortName)}</strong><small>${escape(template.description)}</small><div class="studio-template-key">${escape(template.id)}</div></div><div class="studio-inline-actions"><button class="secondary-button small" data-open-custom="${template.id}">Editar</button><button class="ghost-button small" data-copy-key="${template.id}">Copiar clave</button><button class="ghost-button small" data-export-custom="${template.id}">Exportar</button><button class="ghost-button small" data-delete-custom="${template.id}">Eliminar</button></div></div></article>`).join('')}</div>` : '<div class="empty-state"><span>✦</span><h3>No hay plantillas personalizadas</h3><p>Creá la primera desde el Estudio visual.</p></div>';
    body.querySelectorAll('[data-open-custom]').forEach(button => button.addEventListener('click', () => { dialog.close(); openStudioTemplate(button.dataset.openCustom); }));
    body.querySelectorAll('[data-copy-key]').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard?.writeText(button.dataset.copyKey); studioToast('Clave de plantilla copiada.', 'success'); }));
    body.querySelectorAll('[data-export-custom]').forEach(button => button.addEventListener('click', () => {
      const template = TL.templates.find(item => item.id === button.dataset.exportCustom);
      if (!template) return;
      const payload = { format: TEMPLATE_FORMAT, version: STUDIO_VERSION, exportedAt: new Date().toISOString(), template };
      U.downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${U.slugify(template.name)}.diplomaker-template`);
    }));
    body.querySelectorAll('[data-delete-custom]').forEach(button => button.addEventListener('click', async () => {
      const id = button.dataset.deleteCustom;
      const template = TL.templates.find(item => item.id === id);
      if (!window.confirm(`¿Eliminar la plantilla “${template?.name || id}” de esta computadora?`)) return;
      await deleteStoredTemplate(id);
      unregisterTemplate(id);
      if (state.draft?.id === id) newStudioTemplate();
      updateTemplateCounters();
      showTemplateLibraryDialog();
      studioToast('Plantilla eliminada.', 'success');
    }));
    dialog.showModal();
  }

  function bindStudioEvents() {
    document.getElementById('studioNewButton').addEventListener('click', newStudioTemplate);
    document.getElementById('studioTemplateName').addEventListener('input', event => { state.draft.name = event.target.value; state.draft.shortName = event.target.value; markStudioDirty(); });
    document.getElementById('studioTemplateName').addEventListener('change', pushHistory);
    document.getElementById('studioTemplateDescription').addEventListener('input', event => { state.draft.description = event.target.value; markStudioDirty(); });
    document.getElementById('studioTemplateDescription').addEventListener('change', pushHistory);
    document.getElementById('studioPageColor').addEventListener('input', event => { state.draft.customDefinition.page.backgroundColor = event.target.value; markStudioDirty(); renderCanvas(); });
    document.getElementById('studioPageColor').addEventListener('change', pushHistory);
    document.getElementById('studioDefaultType').addEventListener('input', event => { state.draft.defaultType = event.target.value; markStudioDirty(); renderCanvas(); });
    document.getElementById('studioDefaultType').addEventListener('change', pushHistory);
    document.getElementById('studioUploadBackground').addEventListener('click', () => document.getElementById('studioBackgroundInput').click());
    document.getElementById('studioClearBackground').addEventListener('click', () => { state.draft.customDefinition.page.backgroundData = ''; pushHistory(); markStudioDirty(); renderCanvas(); });
    document.getElementById('studioBackgroundInput').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        state.draft.customDefinition.page.backgroundData = await dataURLFromFile(file);
        pushHistory(); markStudioDirty(); renderCanvas();
      } catch (error) {
        studioToast(error.message || 'No se pudo cargar el fondo.', 'error');
      } finally {
        event.target.value = '';
      }
    });
    document.querySelectorAll('[data-add-element]').forEach(button => button.addEventListener('click', () => addElement(button.dataset.addElement)));
    document.getElementById('studioImageInput').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      const id = event.target.dataset.targetElementId;
      const element = state.draft.customDefinition.elements.find(item => item.id === id);
      try {
        if (file && element) {
          element.src = await dataURLFromFile(file);
          element.name = file.name.replace(/\.[^.]+$/, '') || element.name;
          pushHistory(); markStudioDirty(); renderStudio();
        }
      } catch (error) {
        if (element && !element.src) state.draft.customDefinition.elements = state.draft.customDefinition.elements.filter(item => item.id !== element.id);
        studioToast(error.message || 'No se pudo cargar la imagen.', 'error');
        renderStudio();
      } finally {
        event.target.value = '';
        delete event.target.dataset.targetElementId;
      }
    });
    document.getElementById('studioUndoButton').addEventListener('click', undo);
    document.getElementById('studioRedoButton').addEventListener('click', redo);
    document.getElementById('studioDuplicateButton').addEventListener('click', duplicateSelected);
    document.getElementById('studioDeleteButton').addEventListener('click', deleteSelected);
    document.getElementById('studioBackButton').addEventListener('click', () => changeLayer(-1));
    document.getElementById('studioFrontButton').addEventListener('click', () => changeLayer(1));
    document.getElementById('studioZoomOutButton').addEventListener('click', () => { state.zoom = U.clamp(state.zoom - .1, .25, 1.5); renderCanvas(); });
    document.getElementById('studioZoomInButton').addEventListener('click', () => { state.zoom = U.clamp(state.zoom + .1, .25, 1.5); renderCanvas(); });
    document.getElementById('studioFitButton').addEventListener('click', fitCanvas);
    document.getElementById('studioSaveButton').addEventListener('click', () => saveDraft(false));
    document.getElementById('studioSaveUseButton').addEventListener('click', () => saveDraft(true));
    document.getElementById('studioExportButton').addEventListener('click', exportDraft);
    document.getElementById('studioImportButton').addEventListener('click', () => document.getElementById('studioImportInput').click());
    document.getElementById('studioImportInput').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importTemplateFile(file); } catch (error) { studioToast(error.message || 'No se pudo importar.', 'error'); }
      event.target.value = '';
    });
    document.getElementById('studioOpenLibraryButton').addEventListener('click', showTemplateLibraryDialog);
    document.getElementById('studioCanvas').addEventListener('pointerdown', event => {
      if (event.target.id === 'studioCanvas' || event.target.classList.contains('studio-bg')) selectElement(null);
    });
    window.addEventListener('resize', () => {
      if (document.getElementById('view-studio')?.classList.contains('active')) fitCanvas();
    });
    document.addEventListener('keydown', event => {
      if (!document.getElementById('view-studio')?.classList.contains('active')) return;
      const tag = event.target?.tagName?.toLowerCase();
      const editing = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && !editing) {
        event.preventDefault(); duplicateSelected();
      } else if (!editing && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); deleteSelected();
      } else if (!editing && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (event.key === 'ArrowLeft') moveSelectedBy(-step, 0);
        if (event.key === 'ArrowRight') moveSelectedBy(step, 0);
        if (event.key === 'ArrowUp') moveSelectedBy(0, -step);
        if (event.key === 'ArrowDown') moveSelectedBy(0, step);
      }
    });
  }

  function enhanceTemplateLibraryCards() {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('#templateLibrary .template-library-card').forEach(card => {
        const button = card.querySelector('[data-template-id]');
        const id = button?.dataset.templateId;
        const template = TL.templates.find(item => item.id === id);
        if (!template?.custom || card.querySelector('[data-edit-custom-template]')) return;
        const actions = card.querySelector('.template-library-body');
        if (!actions) return;
        const edit = document.createElement('button');
        edit.className = 'ghost-button small';
        edit.dataset.editCustomTemplate = id;
        edit.textContent = 'Editar';
        edit.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openStudioTemplate(id); });
        actions.appendChild(edit);
      });
      updateTemplateCounters();
    });
    const library = document.getElementById('templateLibrary');
    if (library) observer.observe(library, { childList: true, subtree: true });
  }

  function initializeStudio() {
    injectStudioUI();
    bindStudioNavigation();
    state.draft = defaultTemplateDefinition();
    state.selectedElementId = state.draft.customDefinition.elements[0]?.id || null;
    pushHistory();
    bindStudioEvents();
    enhanceTemplateLibraryCards();
    updateTemplateCounters();
  }

  patchTemplateResolver();
  patchRenderer();
  state.readyPromise = loadCustomTemplates();
  patchStorage();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeStudio);
  else initializeStudio();

  DM.TemplateStudio = {
    version: STUDIO_VERSION,
    show: showStudio,
    openTemplate: openStudioTemplate,
    listTemplates: customTemplates,
    registerTemplate,
    importTemplateFile,
    renderCustomCertificate
  };
})();
