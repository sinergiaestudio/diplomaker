(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};
  const U = DM.Utils;
  const TL = DM.TemplateLibrary;
  const R = DM.Renderer;
  const PDF = DM.PDFWriter;
  const Storage = DM.Storage;

  const $ = id => document.getElementById(id);
  const state = {
    project: null,
    currentView: 'home',
    reviewFilter: 'all',
    editDraft: null,
    renderToken: 0,
    autosaveTimer: null
  };

  const viewMeta = {
    home: ['PROYECTO ACTUAL', 'Estudio de diplomas y certificados'],
    create: ['CREACIÓN', 'Nuevo certificado o lote'],
    data: ['IMPORTACIÓN', 'Asociación de columnas'],
    review: ['CONTROL', 'Revisión de certificados'],
    export: ['EMISIÓN', 'Exportación directa'],
    templates: ['BIBLIOTECA', 'Plantillas generales']
  };

  function newProject() {
    const draft = TL.defaultRecord('classic');
    draft.eventText = '';
    return {
      id: U.uuid('project'),
      format: 'diplomaker-project',
      version: '2.0-public.1',
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

  function migrateProject(project) {
    const base = newProject();
    const merged = { ...base, ...project };
    merged.records = Array.isArray(project.records) ? project.records.map(record => ({
      ...TL.defaultRecord(record.templateId || project.activeTemplateId || 'classic'),
      ...record,
      signers: Array.isArray(record.signers) && record.signers.length ? record.signers : [{ name: '', role: '' }]
    })) : [];
    merged.draft = { ...base.draft, ...(project.draft || {}) };
    merged.draft.signers = Array.isArray(merged.draft.signers) && merged.draft.signers.length ? merged.draft.signers : [{ name: '', role: '' }];
    merged.mapping = project.mapping || {};
    merged.activeTemplateId = TL.getTemplate(project.activeTemplateId || merged.draft.templateId).id;
    merged.draft.templateId = merged.activeTemplateId;
    return merged;
  }

  function toast(message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('toastRegion').appendChild(node);
    setTimeout(() => node.remove(), 3600);
  }

  const autosave = U.debounce(async () => {
    if (!state.project) return;
    try {
      $('autosaveStatus').textContent = 'Guardando localmente…';
      state.project = await Storage.saveProject(state.project);
      const time = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
      $('autosaveStatus').textContent = `Guardado localmente · ${time}`;
    } catch (error) {
      $('autosaveStatus').textContent = 'No se pudo guardar';
      console.error(error);
    }
  }, 450);

  function markDirty() {
    if (!state.project) return;
    state.project.updatedAt = new Date().toISOString();
    $('autosaveStatus').textContent = 'Cambios pendientes…';
    autosave();
    refreshMetrics();
  }

  function showView(name) {
    if (!viewMeta[name]) name = 'home';
    state.currentView = name;
    document.querySelectorAll('[data-view-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === name));
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    $('viewEyebrow').textContent = viewMeta[name][0];
    $('viewTitle').textContent = viewMeta[name][1];
    if (name === 'review') renderReview();
    if (name === 'data') renderMapping();
    if (name === 'export') refreshExportView();
    if (name === 'templates') renderTemplateLibrary();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectMode(mode) {
    state.project.mode = mode === 'batch' ? 'batch' : 'individual';
    document.querySelectorAll('#modeSelector button').forEach(button => button.classList.toggle('active', button.dataset.mode === state.project.mode));
    $('individualFormPanel').classList.toggle('hidden', state.project.mode !== 'individual');
    $('batchImportPanel').classList.toggle('hidden', state.project.mode !== 'batch');
    markDirty();
  }

  function setActiveTemplate(id) {
    const template = TL.getTemplate(id);
    state.project.activeTemplateId = template.id;
    state.project.draft.templateId = template.id;
    if (!state.project.draft.certificateType) state.project.draft.certificateType = template.defaultType;
    renderTemplateChooser();
    renderTemplateLibrary();
    fillIndividualForm();
    markDirty();
  }

  function templateCardHTML(template, compact = true) {
    if (compact) {
      return `<button class="template-choice ${state.project.activeTemplateId === template.id ? 'active' : ''}" data-template-id="${template.id}">
        <span class="template-thumb" style="background-image:url('${template.background}')"></span>
        <span><strong>${U.escapeHTML(template.shortName)}</strong><small>${U.escapeHTML(template.institution)} · hasta ${template.supportsSigners} firmante${template.supportsSigners === 1 ? '' : 's'}</small></span>
      </button>`;
    }
    return `<article class="template-library-card">
      <div class="template-library-preview" style="background-image:url('${template.background}')"></div>
      <div class="template-library-body">
        <div><strong>${U.escapeHTML(template.shortName)}</strong><small>${U.escapeHTML(template.description)}</small></div>
        <button class="${state.project.activeTemplateId === template.id ? 'primary-button' : 'secondary-button'} small" data-template-id="${template.id}">${state.project.activeTemplateId === template.id ? 'Activa' : 'Usar'}</button>
      </div>
    </article>`;
  }

  function renderTemplateChooser() {
    $('templateChooser').innerHTML = TL.templates.map(t => templateCardHTML(t, true)).join('');
    $('templateChooser').querySelectorAll('[data-template-id]').forEach(button => button.addEventListener('click', () => setActiveTemplate(button.dataset.templateId)));
    const active = TL.getTemplate(state.project.activeTemplateId);
    $('activeTemplatePill').textContent = active.shortName;
  }

  function renderTemplateLibrary() {
    $('templateLibrary').innerHTML = TL.templates.map(t => templateCardHTML(t, false)).join('');
    $('templateLibrary').querySelectorAll('[data-template-id]').forEach(button => button.addEventListener('click', () => {
      setActiveTemplate(button.dataset.templateId);
      showView('create');
    }));
  }

  function fillIndividualForm() {
    const form = $('individualForm');
    const draft = state.project.draft;
    for (const name of ['treatment', 'participantName', 'certificateType', 'eventTitle', 'eventDate', 'eventText']) {
      if (form.elements[name]) form.elements[name].value = draft[name] || '';
    }
    renderSignersEditor('signersEditor', draft.signers, false);
  }

  function renderSignersEditor(containerId, signers, editMode) {
    const container = $(containerId);
    container.innerHTML = signers.map((signer, index) => `<div class="signer-row" data-signer-index="${index}">
      <label>Nombre<input data-signer-field="name" value="${U.escapeHTML(signer.name || '')}" placeholder="Nombre del firmante"></label>
      <label>Cargo<input data-signer-field="role" value="${U.escapeHTML(signer.role || '')}" placeholder="Cargo o función"></label>
      <button type="button" class="remove-signer" data-remove-signer="${index}" aria-label="Eliminar firmante">×</button>
    </div>`).join('');

    container.querySelectorAll('[data-signer-field]').forEach(input => input.addEventListener('input', event => {
      const row = event.target.closest('[data-signer-index]');
      const index = Number(row.dataset.signerIndex);
      const target = editMode ? state.editDraft.signers : state.project.draft.signers;
      target[index][event.target.dataset.signerField] = event.target.value;
      if (!editMode) markDirty();
    }));
    container.querySelectorAll('[data-remove-signer]').forEach(button => button.addEventListener('click', () => {
      const target = editMode ? state.editDraft.signers : state.project.draft.signers;
      target.splice(Number(button.dataset.removeSigner), 1);
      if (!target.length) target.push({ name: '', role: '' });
      renderSignersEditor(containerId, target, editMode);
      if (!editMode) markDirty();
    }));
  }

  function syncDraftFromForm() {
    const data = new FormData($('individualForm'));
    for (const key of ['treatment', 'participantName', 'certificateType', 'eventTitle', 'eventDate', 'eventText']) {
      state.project.draft[key] = String(data.get(key) || '').trim();
    }
    state.project.draft.templateId = state.project.activeTemplateId;
  }

  function normalizeTreatment(value) {
    const raw = U.normalizeHeader(value);
    const map = {
      SR: 'Sr.', SENOR: 'Sr.', SEÑOR: 'Sr.',
      SRA: 'Sra.', SENORA: 'Sra.', SEÑORA: 'Sra.',
      DR: 'Dr.', DOCTOR: 'Dr.', DRA: 'Dra.', DOCTORA: 'Dra.',
      ALUMNO: 'Alumno', ALUMNA: 'Alumna'
    };
    return map[raw] || U.normalizeText(value);
  }

  function extractDate(text) {
    const match = String(text || '').match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
    if (!match) return '';
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  function quickValidate(record) {
    const messages = R.baseValidation(record);
    if (U.normalizeText(record.participantName).length > 58) messages.push({ level: 'warning', message: 'El nombre es muy extenso; verificá la vista previa.' });
    if (U.normalizeText(record.eventTitle).length > 165) messages.push({ level: 'warning', message: 'La denominación del evento es muy extensa.' });
    for (const signer of record.signers || []) {
      if (U.normalizeText(signer.role).length > 78) messages.push({ level: 'warning', message: `El cargo de “${signer.name || 'un firmante'}” es extenso.` });
    }
    return { status: R.statusFromMessages(messages), messages };
  }

  function mergeValidation(record, extraMessages) {
    const base = quickValidate(record).messages;
    const seen = new Set();
    const merged = [...base, ...(extraMessages || [])].filter(item => {
      const key = `${item.level}:${item.message}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    record.validation = { status: R.statusFromMessages(merged), messages: merged };
  }

  function refreshDuplicateWarnings() {
    const groups = new Map();
    for (const record of state.project.records) {
      const messages = (record.validation?.messages || quickValidate(record).messages).filter(m => m.code !== 'duplicate-filename');
      record.validation = { status: R.statusFromMessages(messages), messages };
      const base = U.renderPattern(state.project.filenamePattern, record);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base).push(record);
    }
    for (const records of groups.values()) {
      if (records.length < 2) continue;
      records.forEach(record => {
        record.validation.messages.push({ level: 'warning', code: 'duplicate-filename', message: 'El nombre de archivo se repite; Diplomaker agregará un número correlativo.' });
        record.validation.status = R.statusFromMessages(record.validation.messages);
      });
    }
  }

  async function applyIndividual() {
    syncDraftFromForm();
    const record = U.deepClone(state.project.draft);
    record.id = state.project.records[0]?.source === 'individual' ? state.project.records[0].id : U.uuid('record');
    record.source = 'individual';
    record.sourceRow = null;
    record.included = true;
    record.validation = quickValidate(record);
    state.project.records = [record];
    state.project.selectedRecordId = record.id;
    refreshDuplicateWarnings();
    markDirty();
    showView('review');
    toast('Certificado individual preparado para revisión.', 'success');
  }

  async function readDataFile(file) {
    if (!file) return;
    $('importSummary').classList.remove('hidden');
    $('importSummary').innerHTML = '<strong>Leyendo el archivo…</strong>';
    $('continueMappingButton').disabled = true;
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let source;
      if (ext === 'xlsx') source = await DM.XLSXReader.readXLSX(file);
      else if (ext === 'csv') source = await DM.CSVReader.readCSV(file);
      else throw new Error('Formato no compatible. Usá XLSX o CSV.');
      state.project.sourceData = source;
      state.project.selectedSheetIndex = 0;
      state.project.mapping = TL.autoMap(source.sheets[0].headers);
      renderImportSummary();
      markDirty();
      toast(`Archivo ${file.name} cargado.`, 'success');
    } catch (error) {
      console.error(error);
      $('importSummary').innerHTML = `<strong>No se pudo abrir el archivo.</strong><br>${U.escapeHTML(error.message)}`;
      toast(error.message, 'error');
    }
  }

  function currentSheet() {
    return state.project.sourceData?.sheets?.[state.project.selectedSheetIndex] || null;
  }

  function renderImportSummary() {
    const source = state.project.sourceData;
    if (!source) {
      $('importSummary').classList.add('hidden');
      $('sheetChooserWrap').classList.add('hidden');
      $('continueMappingButton').disabled = true;
      return;
    }
    const sheet = currentSheet();
    $('importSummary').classList.remove('hidden');
    $('importSummary').innerHTML = `<strong>${U.escapeHTML(source.filename)}</strong> · ${U.humanFileSize(source.size)}<br>${source.sheets.length} hoja${source.sheets.length === 1 ? '' : 's'} · ${sheet?.rows.length || 0} filas detectadas`;
    $('sheetChooserWrap').classList.toggle('hidden', source.sheets.length < 2);
    $('sheetChooser').innerHTML = source.sheets.map((s, i) => `<option value="${i}" ${i === state.project.selectedSheetIndex ? 'selected' : ''}>${U.escapeHTML(s.name)} · ${s.rows.length} filas</option>`).join('');
    $('continueMappingButton').disabled = !sheet || !sheet.headers.length;
  }

  function renderMapping() {
    const source = state.project.sourceData;
    const sheet = currentSheet();
    $('mappingEmptyState').classList.toggle('hidden', !!sheet);
    $('mappingWorkspace').classList.toggle('hidden', !sheet);
    $('mappingFilePill').textContent = source ? source.filename : 'Sin archivo';
    if (!sheet) return;

    const mapping = state.project.mapping || (state.project.mapping = TL.autoMap(sheet.headers));
    $('mappingFields').innerHTML = TL.canonicalFields.map(field => `<div class="mapping-row">
      <span class="canonical">${U.escapeHTML(field.label)}${field.required ? ' *' : ''}</span>
      <span class="arrow">←</span>
      <select data-mapping-key="${field.key}">
        <option value="">No asociar</option>
        ${sheet.headers.map(header => `<option value="${U.escapeHTML(header)}" ${mapping[field.key] === header ? 'selected' : ''}>${U.escapeHTML(header)}</option>`).join('')}
      </select>
    </div>`).join('');
    $('mappingFields').querySelectorAll('[data-mapping-key]').forEach(select => select.addEventListener('change', () => {
      state.project.mapping[select.dataset.mappingKey] = select.value;
      markDirty();
    }));

    const previewHeaders = sheet.headers.slice(0, 7);
    $('sourcePreviewTable').innerHTML = `<thead><tr>${previewHeaders.map(h => `<th>${U.escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>${sheet.rows.slice(0, 8).map(row => `<tr>${previewHeaders.map(h => `<td>${U.escapeHTML(row[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $('mappingRowsPill').textContent = `${sheet.rows.length} filas`;
  }

  function mapped(row, key) {
    const header = state.project.mapping?.[key];
    return header ? row[header] : '';
  }

  function buildRecords() {
    const sheet = currentSheet();
    if (!sheet) return;
    if (!state.project.mapping.participantName) {
      toast('Asociá una columna con “Nombre y apellido”.', 'error');
      return;
    }
    const records = sheet.rows.map(row => {
      const rawTemplate = mapped(row, 'templateId');
      const templateId = TL.resolveTemplate(rawTemplate, state.project.activeTemplateId);
      const template = TL.getTemplate(templateId);
      const eventTitle = U.normalizeText(mapped(row, 'eventTitle'));
      const eventDate = U.normalizeText(mapped(row, 'eventDate')) || extractDate(eventTitle);
      const signers = [];
      for (let i = 1; i <= 4; i++) {
        const name = U.normalizeText(mapped(row, `signer${i}Name`));
        const role = U.normalizeText(mapped(row, `signer${i}Role`));
        if (name || role) signers.push({ name, role });
      }
      if (!signers.length) signers.push({ name: '', role: '' });
      const record = {
        id: U.uuid('record'),
        templateId,
        treatment: normalizeTreatment(mapped(row, 'treatment')),
        participantName: U.normalizeText(mapped(row, 'participantName')),
        certificateType: U.normalizeText(mapped(row, 'certificateType')).toLocaleUpperCase('es-AR') || template.defaultType,
        eventTitle,
        eventDate,
        eventText: U.normalizeText(mapped(row, 'eventText')),
        fileName: U.normalizeText(mapped(row, 'fileName')),
        signers,
        included: true,
        sourceRow: row.__rowNumber || null,
        source: 'batch',
        validation: { status: 'ready', messages: [] }
      };
      record.validation = quickValidate(record);
      return record;
    });
    state.project.records = records;
    state.project.selectedRecordId = records[0]?.id || null;
    refreshDuplicateWarnings();
    markDirty();
    showView('review');
    toast(`${records.length} registros creados.`, 'success');
  }

  function recordCounts() {
    const counts = { all: 0, ready: 0, warning: 0, error: 0 };
    for (const record of state.project.records) {
      counts.all++;
      counts[record.validation?.status || 'warning']++;
    }
    return counts;
  }

  function refreshMetrics() {
    if (!state.project) return;
    const counts = recordCounts();
    $('homeRecordCount').textContent = counts.all;
    $('metricTemplate').textContent = TL.getTemplate(state.project.activeTemplateId).shortName;
    $('metricReady').textContent = counts.ready;
    $('metricWarnings').textContent = counts.warning;
    $('metricErrors').textContent = counts.error;
  }

  function filteredRecords() {
    const filter = state.reviewFilter;
    return state.project.records.filter(record => filter === 'all' || record.validation?.status === filter);
  }

  function renderRecordsTable() {
    const records = filteredRecords();
    const counts = recordCounts();
    $('countAll').textContent = counts.all;
    $('countReady').textContent = counts.ready;
    $('countWarning').textContent = counts.warning;
    $('countError').textContent = counts.error;
    if (!records.length) {
      $('recordsTable').innerHTML = '<tbody><tr><td>No hay registros para este filtro.</td></tr></tbody>';
      return;
    }
    $('recordsTable').innerHTML = `<thead><tr><th>Estado</th><th>Participante</th><th>Tipo</th><th>Plantilla</th></tr></thead><tbody>${records.map(record => {
      const status = record.validation?.status || 'warning';
      return `<tr data-record-id="${record.id}" class="${record.id === state.project.selectedRecordId ? 'selected' : ''}">
        <td><span class="status-dot status-${status}"></span>${status === 'ready' ? 'Listo' : status === 'warning' ? 'Revisar' : 'Error'}</td>
        <td><span class="record-name">${U.escapeHTML(record.participantName || 'Sin nombre')}</span><span class="record-meta">${U.escapeHTML(record.eventTitle || 'Sin evento')}</span></td>
        <td>${U.escapeHTML(record.certificateType || '')}</td>
        <td>${U.escapeHTML(TL.getTemplate(record.templateId).shortName)}</td>
      </tr>`;
    }).join('')}</tbody>`;
    $('recordsTable').querySelectorAll('[data-record-id]').forEach(row => {
      row.addEventListener('click', () => selectRecord(row.dataset.recordId));
      row.addEventListener('dblclick', () => openEditDialog(row.dataset.recordId));
    });
  }

  function renderReview() {
    refreshDuplicateWarnings();
    renderRecordsTable();
    if (!state.project.records.length) {
      $('previewRecordName').textContent = 'Sin registros';
      $('previewRecordMeta').textContent = 'Creá un certificado o cargá una planilla.';
      $('canvasPlaceholder').classList.remove('hidden');
      $('validationList').innerHTML = '';
      return;
    }
    if (!state.project.records.some(record => record.id === state.project.selectedRecordId)) state.project.selectedRecordId = state.project.records[0].id;
    renderSelectedPreview();
    refreshMetrics();
  }

  function selectedRecord() {
    return state.project.records.find(record => record.id === state.project.selectedRecordId) || null;
  }

  function selectRecord(id) {
    state.project.selectedRecordId = id;
    renderRecordsTable();
    renderSelectedPreview();
    markDirty();
  }

  async function renderSelectedPreview() {
    const record = selectedRecord();
    if (!record) return;
    const token = ++state.renderToken;
    $('previewRecordName').textContent = record.participantName || 'Sin nombre';
    $('previewRecordMeta').textContent = `${record.certificateType || 'Certificado'} · ${TL.getTemplate(record.templateId).shortName}`;
    $('canvasPlaceholder').classList.add('hidden');
    try {
      const result = await R.renderCertificate(record, $('certificateCanvas'), { scale: 1 });
      if (token !== state.renderToken) return;
      mergeValidation(record, result.messages);
      renderValidationList(record);
      renderRecordsTable();
      refreshMetrics();
    } catch (error) {
      $('canvasPlaceholder').textContent = error.message;
      $('canvasPlaceholder').classList.remove('hidden');
    }
  }

  function renderValidationList(record) {
    const messages = record.validation?.messages || [];
    if (!messages.length) {
      $('validationList').innerHTML = '<div class="validation-item ready">✓ No se detectaron problemas.</div>';
      return;
    }
    $('validationList').innerHTML = messages.map(item => `<div class="validation-item ${item.level}">${item.level === 'error' ? '×' : item.level === 'warning' ? '!' : '✓'} ${U.escapeHTML(item.message)}</div>`).join('');
  }

  function moveSelection(direction) {
    const records = state.project.records;
    if (!records.length) return;
    let index = records.findIndex(record => record.id === state.project.selectedRecordId);
    index = (index + direction + records.length) % records.length;
    selectRecord(records[index].id);
  }

  function openEditDialog(id) {
    const record = state.project.records.find(item => item.id === id);
    if (!record) return;
    state.editDraft = U.deepClone(record);
    const form = $('editRecordForm');
    for (const name of ['treatment', 'participantName', 'certificateType', 'eventTitle', 'eventDate', 'eventText']) form.elements[name].value = state.editDraft[name] || '';
    form.elements.templateId.innerHTML = TL.templates.map(t => `<option value="${t.id}" ${t.id === state.editDraft.templateId ? 'selected' : ''}>${U.escapeHTML(t.shortName)}</option>`).join('');
    renderSignersEditor('editSignersEditor', state.editDraft.signers, true);
    $('editRecordDialog').showModal();
  }

  function saveEditedRecord() {
    if (!state.editDraft) return;
    const data = new FormData($('editRecordForm'));
    for (const key of ['treatment', 'participantName', 'certificateType', 'eventTitle', 'eventDate', 'eventText', 'templateId']) state.editDraft[key] = String(data.get(key) || '').trim();
    state.editDraft.validation = quickValidate(state.editDraft);
    const index = state.project.records.findIndex(record => record.id === state.editDraft.id);
    if (index >= 0) state.project.records[index] = state.editDraft;
    refreshDuplicateWarnings();
    $('editRecordDialog').close();
    state.editDraft = null;
    markDirty();
    renderReview();
    toast('Cambios guardados.', 'success');
  }

  function exportableRecords() {
    return state.project.records.filter(record => record.included !== false && record.validation?.status !== 'error');
  }

  function refreshExportView() {
    const records = exportableRecords();
    $('exportCountPill').textContent = `${records.length} certificado${records.length === 1 ? '' : 's'}`;
    $('filenamePattern').value = state.project.filenamePattern;
  }

  async function runExport(button, action, message) {
    if (!button) return;
    const old = button.innerHTML;
    button.disabled = true;
    button.style.opacity = '.7';
    $('autosaveStatus').textContent = 'Generando archivos…';
    try {
      await action((done, total) => { $('autosaveStatus').textContent = `Generando ${done} de ${total}…`; });
      toast(message, 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'No se pudo exportar.', 'error');
    } finally {
      button.disabled = false;
      button.style.opacity = '';
      button.innerHTML = old;
      autosave();
    }
  }

  function projectBaseName() {
    return U.slugify(state.project.name === 'Proyecto sin título' ? 'Diplomaker_Certificados' : state.project.name);
  }

  async function exportCurrentPDF() {
    const record = selectedRecord() || exportableRecords()[0];
    if (!record) throw new Error('No hay un certificado exportable.');
    const { blob } = await PDF.recordToPDF(record, { scale: 2 });
    U.downloadBlob(blob, `${U.renderPattern(state.project.filenamePattern, record)}.pdf`);
  }

  async function exportCombinedPDF(progress) {
    const records = exportableRecords();
    if (!records.length) throw new Error('No hay certificados exportables.');
    const blob = await PDF.recordsToCombinedPDF(records, { scale: 2, title: state.project.name }, progress);
    U.downloadBlob(blob, `${projectBaseName()}_conjunto.pdf`);
  }

  async function exportZIP(progress) {
    const records = exportableRecords();
    if (!records.length) throw new Error('No hay certificados exportables.');
    const blob = await PDF.recordsToZip(records, state.project.filenamePattern, { scale: 2 }, progress);
    U.downloadBlob(blob, `${projectBaseName()}_individuales.zip`);
  }

  async function exportCurrentPNG() {
    const record = selectedRecord() || exportableRecords()[0];
    if (!record) throw new Error('No hay un certificado exportable.');
    const { blob } = await PDF.recordToPNG(record, 2);
    U.downloadBlob(blob, `${U.renderPattern(state.project.filenamePattern, record)}.png`);
  }

  function exportReport() {
    const headers = ['FILA', 'NOMBRE', 'TIPO', 'PLANTILLA', 'ESTADO', 'OBSERVACIONES', 'ARCHIVO'];
    const rows = state.project.records.map(record => ({
      FILA: record.sourceRow || '',
      NOMBRE: record.participantName,
      TIPO: record.certificateType,
      PLANTILLA: TL.getTemplate(record.templateId).shortName,
      ESTADO: record.validation?.status || '',
      OBSERVACIONES: (record.validation?.messages || []).map(m => m.message).join(' | '),
      ARCHIVO: `${U.renderPattern(state.project.filenamePattern, record)}.pdf`
    }));
    const csv = U.makeCSV(headers, rows, ';');
    U.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${projectBaseName()}_informe.csv`);
  }

  async function savePortableProject() {
    state.project = await Storage.saveProject(state.project);
    U.downloadBlob(Storage.exportProject(state.project), `${projectBaseName()}.diplomaker`);
    toast('Proyecto guardado en esta computadora y exportado.', 'success');
  }

  async function openPortableProject(file) {
    try {
      state.project = migrateProject(await Storage.importProject(file));
      await Storage.saveProject(state.project);
      applyProjectToUI();
      showView('home');
      toast('Proyecto abierto correctamente.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function applyProjectToUI() {
    renderTemplateChooser();
    renderTemplateLibrary();
    fillIndividualForm();
    selectMode(state.project.mode);
    renderImportSummary();
    refreshMetrics();
    refreshExportView();
    if (state.project.sourceData) renderMapping();
  }

  function bindEvents() {
    document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
    document.querySelectorAll('[data-view-target]').forEach(button => button.addEventListener('click', () => showView(button.dataset.viewTarget)));
    document.querySelectorAll('[data-start-mode]').forEach(button => button.addEventListener('click', () => { selectMode(button.dataset.startMode); showView('create'); }));
    document.querySelectorAll('#modeSelector button').forEach(button => button.addEventListener('click', () => selectMode(button.dataset.mode)));

    $('individualForm').addEventListener('input', () => { syncDraftFromForm(); markDirty(); });
    $('addSignerButton').addEventListener('click', () => { state.project.draft.signers.push({ name: '', role: '' }); renderSignersEditor('signersEditor', state.project.draft.signers, false); markDirty(); });
    $('applyIndividualButton').addEventListener('click', applyIndividual);

    const dropzone = $('dataDropzone');
    $('dataFileInput').addEventListener('change', event => readDataFile(event.target.files?.[0]));
    ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('dragover'); }));
    dropzone.addEventListener('drop', event => readDataFile(event.dataTransfer.files?.[0]));
    $('sheetChooser').addEventListener('change', () => {
      state.project.selectedSheetIndex = Number($('sheetChooser').value);
      state.project.mapping = TL.autoMap(currentSheet().headers);
      renderImportSummary(); markDirty();
    });
    $('continueMappingButton').addEventListener('click', () => showView('data'));
    $('buildRecordsButton').addEventListener('click', buildRecords);

    document.querySelectorAll('#reviewFilters [data-filter]').forEach(button => button.addEventListener('click', () => {
      state.reviewFilter = button.dataset.filter;
      document.querySelectorAll('#reviewFilters [data-filter]').forEach(item => item.classList.toggle('active', item === button));
      renderRecordsTable();
    }));
    $('prevRecordButton').addEventListener('click', () => moveSelection(-1));
    $('nextRecordButton').addEventListener('click', () => moveSelection(1));
    $('editRecordButton').addEventListener('click', () => selectedRecord() && openEditDialog(selectedRecord().id));
    $('editAddSignerButton').addEventListener('click', () => { if (!state.editDraft) return; state.editDraft.signers.push({ name: '', role: '' }); renderSignersEditor('editSignersEditor', state.editDraft.signers, true); });
    $('editRecordForm').addEventListener('submit', event => { event.preventDefault(); saveEditedRecord(); });

    $('filenamePattern').addEventListener('input', () => { state.project.filenamePattern = $('filenamePattern').value || '{NOMBRE}'; refreshDuplicateWarnings(); markDirty(); });
    $('exportCurrentPdfButton').addEventListener('click', () => runExport($('exportCurrentPdfButton'), exportCurrentPDF, 'PDF generado.'));
    $('exportCombinedPdfButton').addEventListener('click', () => runExport($('exportCombinedPdfButton'), exportCombinedPDF, 'PDF conjunto generado.'));
    $('exportZipButton').addEventListener('click', () => runExport($('exportZipButton'), exportZIP, 'ZIP generado.'));
    $('exportCurrentPngButton').addEventListener('click', () => runExport($('exportCurrentPngButton'), exportCurrentPNG, 'PNG generado.'));
    $('exportReportButton').addEventListener('click', () => runExport($('exportReportButton'), async () => exportReport(), 'Informe generado.'));

    $('saveProjectButton').addEventListener('click', savePortableProject);
    $('openProjectButton').addEventListener('click', () => $('projectFileInput').click());
    $('projectFileInput').addEventListener('change', event => { if (event.target.files?.[0]) openPortableProject(event.target.files[0]); event.target.value = ''; });
    $('helpButton').addEventListener('click', () => $('helpDialog').showModal());
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
  }

  async function init() {
    bindEvents();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(error => console.warn('No se pudo registrar el modo instalable.', error));
    }
    try {
      const existing = await Storage.loadLastProject();
      state.project = existing ? migrateProject(existing) : newProject();
    } catch (error) {
      console.warn('No se pudo recuperar el proyecto anterior.', error);
      state.project = newProject();
    }
    applyProjectToUI();
    showView('home');
    autosave();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
