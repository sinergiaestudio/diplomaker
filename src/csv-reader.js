(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};
  const U = DM.Utils;

  function detectDelimiter(text) {
    const sample = String(text).split(/\r?\n/).slice(0, 8).join('\n');
    const candidates = [';', ',', '\t', '|'];
    let best = ';'; let bestScore = -1;
    for (const delimiter of candidates) {
      const rows = parseRows(sample, delimiter).filter(r => r.some(v => String(v).trim()));
      if (!rows.length) continue;
      const widths = rows.map(r => r.length);
      const mode = widths.sort((a, b) => widths.filter(v => v === a).length - widths.filter(v => v === b).length).pop();
      const consistency = widths.filter(v => v === mode).length / widths.length;
      const score = (mode > 1 ? mode : 0) * consistency;
      if (score > bestScore) { bestScore = score; best = delimiter; }
    }
    return best;
  }

  function parseRows(text, delimiter) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    const source = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      const next = source[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') { value += '"'; i++; }
        else if (char === '"') quoted = false;
        else value += char;
      } else {
        if (char === '"') quoted = true;
        else if (char === delimiter) { row.push(value); value = ''; }
        else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
        else value += char;
      }
    }
    if (value.length || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }

  function detectHeaderRow(rows) {
    const limit = Math.min(rows.length, 15);
    let bestIndex = 0; let bestScore = -Infinity;
    for (let i = 0; i < limit; i++) {
      const cells = rows[i].map(v => U.normalizeText(v));
      const nonEmpty = cells.filter(Boolean).length;
      const unique = new Set(cells.filter(Boolean).map(U.normalizeHeader)).size;
      const textish = cells.filter(v => v && Number.isNaN(Number(v))).length;
      const score = nonEmpty * 3 + unique + textish - i * .15;
      if (score > bestScore) { bestScore = score; bestIndex = i; }
    }
    return bestIndex;
  }

  function rowsToSheet(name, matrix) {
    const cleaned = matrix.filter(row => row.some(cell => U.normalizeText(cell)));
    if (!cleaned.length) return { name, headers: [], rows: [], matrix: [], headerRowIndex: 0 };
    const headerRowIndex = detectHeaderRow(cleaned);
    const rawHeaders = cleaned[headerRowIndex].map((h, i) => U.normalizeText(h) || `COLUMNA_${i + 1}`);
    const seen = new Map();
    const headers = rawHeaders.map((header, i) => {
      let candidate = header || `COLUMNA_${i + 1}`;
      const key = U.normalizeHeader(candidate);
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      if (count > 1) candidate = `${candidate}_${count}`;
      return candidate;
    });
    const looksLikeInstructionRow = record => {
      const values = headers.map(h => U.normalizeText(record[h])).filter(Boolean);
      const joined = U.normalizeHeader(values.join(' '));
      const markers = ['OPCIONAL', 'OBLIGATORIO', 'TEXTO_LIBRE', 'SEGUN_PLANTILLA', 'UNA_FILA_POR', 'PARTICIPACION_MODERACION_ASISTENCIA'];
      const markerCount = markers.filter(marker => joined.includes(marker)).length;
      const pipeCount = values.filter(value => value.includes('|')).length;
      return markerCount >= 2 || (markerCount >= 1 && pipeCount >= 2);
    };
    const rows = cleaned.slice(headerRowIndex + 1).map((cells, idx) => {
      const record = { __rowNumber: headerRowIndex + idx + 2 };
      headers.forEach((header, col) => record[header] = U.normalizeText(cells[col]));
      return record;
    }).filter(record => headers.some(h => U.normalizeText(record[h])) && !looksLikeInstructionRow(record));
    return { name, headers, rows, matrix: cleaned, headerRowIndex };
  }

  async function readCSV(file) {
    const text = await U.readAsText(file);
    const delimiter = detectDelimiter(text);
    const matrix = parseRows(text, delimiter);
    return {
      kind: 'csv',
      filename: file.name,
      size: file.size,
      sheets: [rowsToSheet('Datos', matrix)],
      delimiter
    };
  }

  DM.CSVReader = { readCSV, parseRows, rowsToSheet, detectDelimiter };
})();
