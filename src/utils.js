(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};

  const Utils = {
    uuid(prefix = 'id') {
      const c = window.crypto;
      if (c && c.randomUUID) return `${prefix}-${c.randomUUID()}`;
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    },

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    normalizeHeader(value) {
      return String(value ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_')
        .replace(/_+/g, '_').replace(/^_|_$/g, '').toUpperCase();
    },

    normalizeText(value) {
      return String(value ?? '').trim().replace(/\s+/g, ' ');
    },

    slugify(value) {
      return String(value ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ').trim()
        .replace(/\s/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_\.]+|[_\.]+$/g, '') || 'certificado';
    },

    safeFilename(value) {
      let out = String(value ?? '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '');
      if (!out) out = 'certificado';
      const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
      if (reserved.test(out)) out = `_${out}`;
      return out.slice(0, 180).replace(/[. ]+$/g, '') || 'certificado';
    },

    escapeHTML(value) {
      return String(value ?? '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[char]);
    },

    titleCase(value) {
      return String(value ?? '').toLocaleLowerCase('es-AR').replace(/(^|[\s\-'])\p{L}/gu, m => m.toLocaleUpperCase('es-AR'));
    },

    formatDate(value) {
      if (!value) return '';
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
      }
      const raw = String(value).trim();
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
      const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
      if (dmy) return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]}`;
      return raw;
    },

    excelSerialToDate(serial) {
      if (!Number.isFinite(serial)) return null;
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const fractionalDay = serial - Math.floor(serial) + 0.0000001;
      const totalSeconds = Math.floor(86400 * fractionalDay);
      const date = new Date((utcValue + totalSeconds) * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    },

    readAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
        reader.readAsText(file, 'utf-8');
      });
    },

    readAsArrayBuffer(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
        reader.readAsArrayBuffer(file);
      });
    },

    blobFromDataURL(dataURL) {
      const [meta, body] = dataURL.split(',');
      const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    },

    uint8FromDataURL(dataURL) {
      const body = dataURL.split(',')[1];
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    },

    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    },

    debounce(fn, delay = 300) {
      let timer = null;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    deepClone(value) {
      if (window.structuredClone) return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    },

    dedupe(values) {
      return [...new Set(values)];
    },

    csvEscape(value) {
      const raw = String(value ?? '');
      if (/[";\n\r,]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
      return raw;
    },

    makeCSV(headers, rows, delimiter = ';') {
      const lines = [headers.map(Utils.csvEscape).join(delimiter)];
      for (const row of rows) lines.push(headers.map(h => Utils.csvEscape(row[h])).join(delimiter));
      return '\uFEFF' + lines.join('\r\n');
    },

    humanFileSize(bytes) {
      if (!Number.isFinite(bytes)) return '';
      const units = ['B', 'KB', 'MB', 'GB'];
      let value = bytes; let unit = 0;
      while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
      return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
    },

    renderPattern(pattern, record) {
      const fullName = Utils.normalizeText(record.participantName);
      const parts = fullName.split(' ').filter(Boolean);
      const particles = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
      let surnameStart = Math.max(0, parts.length - 1);
      let hasParticleChain = false;
      while (surnameStart > 0 && particles.has(parts[surnameStart - 1].toLocaleLowerCase('es-AR'))) { surnameStart--; hasParticleChain = true; }
      if (hasParticleChain && surnameStart > 0) surnameStart--;
      const surname = parts.slice(surnameStart).join(' ');
      const givenNames = parts.slice(0, surnameStart).join(' ');
      const nameFirst = givenNames ? `${surname} ${givenNames}` : fullName;
      const suggested = Utils.normalizeText(record.fileName) || nameFirst || fullName || 'certificado';
      const replacements = {
        '{NOMBRE}': fullName,
        '{APELLIDO_NOMBRE}': nameFirst,
        '{ID_ARCHIVO}': suggested,
        '{TIPO_CERTIFICADO}': record.certificateType || 'Certificado',
        '{EVENTO}': record.eventTitle || 'Evento',
        '{FECHA}': Utils.formatDate(record.eventDate)
      };
      let out = String(pattern || '{ID_ARCHIVO}');
      for (const [key, value] of Object.entries(replacements)) out = out.split(key).join(value);
      return Utils.safeFilename(out);
    }
  };

  DM.Utils = Utils;
})();
