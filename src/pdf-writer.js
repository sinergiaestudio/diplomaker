(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};
  const U = DM.Utils;

  const encoder = new TextEncoder();
  const PAGE_WIDTH = 841.89;
  const PAGE_HEIGHT = 595.28;

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  }

  function ascii(value) {
    return encoder.encode(String(value));
  }


  function pdfUnicodeHex(value) {
    const text = String(value || '');
    const bytes = [0xFE, 0xFF];
    for (const char of text) {
      const code = char.codePointAt(0);
      if (code <= 0xFFFF) {
        bytes.push((code >> 8) & 0xFF, code & 0xFF);
      } else {
        const cp = code - 0x10000;
        const high = 0xD800 + (cp >> 10);
        const low = 0xDC00 + (cp & 0x3FF);
        bytes.push((high >> 8) & 0xFF, high & 0xFF, (low >> 8) & 0xFF, low & 0xFF);
      }
    }
    return `<${bytes.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}>`;
  }

  function canvasToBlob(canvas, type = 'image/jpeg', quality = .94) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo convertir el certificado en imagen.')), type, quality);
      } catch (error) {
        if (error && /tainted|security/i.test(String(error.message || error))) {
          reject(new Error('La plantilla contiene un recurso local no incorporado al proyecto. Abra esta versión corregida de Diplomaker o vuelva a importar la plantilla.'));
          return;
        }
        reject(error);
      }
    });
  }

  async function jpegPageFromRecord(record, scale = 2) {
    const { canvas, validation } = await DM.Renderer.renderToCanvas(record, scale);
    const blob = await canvasToBlob(canvas, 'image/jpeg', .95);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, width: canvas.width, height: canvas.height, validation };
  }

  function makePDF(jpegPages, metadata = {}) {
    if (!jpegPages.length) throw new Error('No hay páginas para exportar.');
    const objectCount = 2 + jpegPages.length * 3;
    const objects = new Array(objectCount + 1);

    objects[1] = ascii('<< /Type /Catalog /Pages 2 0 R >>');
    const pageNumbers = jpegPages.map((_, index) => 3 + index * 3);
    objects[2] = ascii(`<< /Type /Pages /Kids [${pageNumbers.map(n => `${n} 0 R`).join(' ')}] /Count ${jpegPages.length} >>`);

    jpegPages.forEach((page, index) => {
      const pageObj = 3 + index * 3;
      const imageObj = pageObj + 1;
      const contentObj = pageObj + 2;
      objects[pageObj] = ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /ProcSet [/PDF /ImageC] /XObject << /Im${index + 1} ${imageObj} 0 R >> >> ` +
        `/Contents ${contentObj} 0 R >>`
      );
      const imageHeader = ascii(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`
      );
      const imageFooter = ascii('\nendstream');
      objects[imageObj] = concatBytes([imageHeader, page.bytes, imageFooter]);
      const content = `q\n${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm\n/Im${index + 1} Do\nQ\n`;
      objects[contentObj] = ascii(`<< /Length ${ascii(content).length} >>\nstream\n${content}endstream`);
    });

    const parts = [ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
    const offsets = new Array(objectCount + 1).fill(0);
    let cursor = parts[0].length;
    for (let number = 1; number <= objectCount; number++) {
      offsets[number] = cursor;
      const wrapped = concatBytes([ascii(`${number} 0 obj\n`), objects[number], ascii('\nendobj\n')]);
      parts.push(wrapped);
      cursor += wrapped.length;
    }
    const xrefOffset = cursor;
    const xrefLines = [`xref\n0 ${objectCount + 1}\n`, '0000000000 65535 f \n'];
    for (let number = 1; number <= objectCount; number++) {
      xrefLines.push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
    }
    const title = pdfUnicodeHex(metadata.title || 'Diplomaker');
    const trailer =
      xrefLines.join('') +
      `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info << /Title ${title} /Producer (Diplomaker 2.0) >> >>\n` +
      `startxref\n${xrefOffset}\n%%EOF`;
    parts.push(ascii(trailer));
    return new Blob(parts, { type: 'application/pdf' });
  }

  async function recordToPDF(record, options = {}) {
    const page = await jpegPageFromRecord(record, options.scale || 2);
    return { blob: makePDF([page], { title: record.participantName }), validation: page.validation };
  }

  async function recordsToCombinedPDF(records, options = {}, progress) {
    const pages = [];
    for (let i = 0; i < records.length; i++) {
      pages.push(await jpegPageFromRecord(records[i], options.scale || 2));
      if (progress) progress(i + 1, records.length);
    }
    return makePDF(pages, { title: options.title || 'Certificados' });
  }

  async function recordsToZip(records, filenamePattern, options = {}, progress) {
    if (!window.JSZip) throw new Error('El generador ZIP no está disponible.');
    const zip = new JSZip();
    const used = new Map();
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const { blob } = await recordToPDF(record, options);
      let base = U.renderPattern(filenamePattern, record);
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      if (count > 1) base = `${base}_${count}`;
      zip.file(`${base}.pdf`, blob);
      if (progress) progress(i + 1, records.length);
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  async function recordToPNG(record, scale = 2) {
    const { canvas, validation } = await DM.Renderer.renderToCanvas(record, scale);
    const blob = await canvasToBlob(canvas, 'image/png');
    return { blob, validation };
  }

  DM.PDFWriter = { recordToPDF, recordsToCombinedPDF, recordsToZip, recordToPNG, makePDF };
})();
