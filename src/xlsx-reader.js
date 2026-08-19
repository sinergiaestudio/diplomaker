(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};
  const U = DM.Utils;

  function parseXML(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const error = doc.querySelector('parsererror');
    if (error) throw new Error('El archivo XLSX contiene XML inválido.');
    return doc;
  }

  function localNameElements(root, name) {
    return [...root.getElementsByTagNameNS('*', name)];
  }

  function resolvePath(base, target) {
    const raw = String(target || '').replace(/^\/+/, '');
    if (raw.startsWith('xl/')) return raw;
    const stack = base.split('/').slice(0, -1);
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') stack.pop(); else stack.push(part);
    }
    return stack.join('/');
  }

  function columnIndexFromRef(ref) {
    const letters = (String(ref).match(/[A-Z]+/i) || ['A'])[0].toUpperCase();
    let index = 0;
    for (let i = 0; i < letters.length; i++) index = index * 26 + (letters.charCodeAt(i) - 64);
    return index - 1;
  }

  function sharedStringsFromDoc(doc) {
    return localNameElements(doc, 'si').map(si => localNameElements(si, 't').map(t => t.textContent || '').join(''));
  }

  function getRelId(element) {
    for (const attr of [...element.attributes]) {
      if (attr.localName === 'id') return attr.value;
    }
    return '';
  }

  function parseRelationships(doc) {
    const map = new Map();
    for (const rel of localNameElements(doc, 'Relationship')) {
      map.set(rel.getAttribute('Id'), rel.getAttribute('Target'));
    }
    return map;
  }

  function getCellText(cell, sharedStrings) {
    const type = cell.getAttribute('t') || '';
    const v = localNameElements(cell, 'v')[0]?.textContent ?? '';
    if (type === 's') return sharedStrings[Number(v)] ?? '';
    if (type === 'inlineStr') return localNameElements(cell, 't').map(t => t.textContent || '').join('');
    if (type === 'b') return v === '1' ? 'VERDADERO' : 'FALSO';
    if (type === 'str' || type === 'e') return v;
    if (v === '') return '';
    return v;
  }

  function worksheetToMatrix(doc, sharedStrings) {
    const matrix = [];
    for (const rowElement of localNameElements(doc, 'row')) {
      const rowNumber = Math.max(1, Number(rowElement.getAttribute('r') || matrix.length + 1));
      const row = [];
      for (const cell of localNameElements(rowElement, 'c')) {
        const index = columnIndexFromRef(cell.getAttribute('r') || 'A1');
        row[index] = getCellText(cell, sharedStrings);
      }
      while (matrix.length < rowNumber - 1) matrix.push([]);
      matrix[rowNumber - 1] = row;
    }
    return matrix;
  }

  async function readZipText(zip, path, required = true) {
    const file = zip.file(path);
    if (!file) {
      if (required) throw new Error(`No se encontró ${path} dentro del XLSX.`);
      return '';
    }
    return file.async('string');
  }

  async function readXLSX(file) {
    if (!window.JSZip) throw new Error('El lector XLSX no está disponible.');
    const buffer = await U.readAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(buffer);

    const workbookPath = 'xl/workbook.xml';
    const workbookXML = await readZipText(zip, workbookPath);
    const workbookDoc = parseXML(workbookXML);
    const relsXML = await readZipText(zip, 'xl/_rels/workbook.xml.rels');
    const rels = parseRelationships(parseXML(relsXML));

    let sharedStrings = [];
    const sharedText = await readZipText(zip, 'xl/sharedStrings.xml', false);
    if (sharedText) sharedStrings = sharedStringsFromDoc(parseXML(sharedText));

    const sheets = [];
    const sheetNodes = localNameElements(workbookDoc, 'sheet');
    for (let i = 0; i < sheetNodes.length; i++) {
      const sheetNode = sheetNodes[i];
      const name = sheetNode.getAttribute('name') || `Hoja ${i + 1}`;
      const relId = getRelId(sheetNode);
      const target = rels.get(relId);
      if (!target) continue;
      const sheetPath = resolvePath(workbookPath, target);
      const sheetXML = await readZipText(zip, sheetPath);
      const matrix = worksheetToMatrix(parseXML(sheetXML), sharedStrings);
      const sheet = DM.CSVReader.rowsToSheet(name, matrix);
      sheets.push(sheet);
    }

    if (!sheets.length) throw new Error('El XLSX no contiene hojas legibles.');
    return { kind: 'xlsx', filename: file.name, size: file.size, sheets };
  }

  DM.XLSXReader = { readXLSX };
})();
