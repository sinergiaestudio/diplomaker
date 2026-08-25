const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'test-artifacts');
fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(OUTPUT, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function downloadedBytes(download, filename) {
  const target = path.join(OUTPUT, filename || download.suggestedFilename());
  await download.saveAs(target);
  return { target, bytes: fs.readFileSync(target) };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    acceptDownloads: true,
    locale: 'es-AR'
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.Diplomaker?.Experience));
  await page.waitForFunction(() => document.querySelector('.hero-copy h2')?.textContent.includes('Diseñá una vez'));

  const title = await page.title();
  assert(title.includes('Diseñá una vez'), 'La identidad oficial no se aplicó al título.');
  assert(await page.getAttribute('html', 'data-theme') === 'light', 'La primera apertura no inició en tema claro.');
  assert(await page.locator('.experience-author a').getAttribute('href') === 'https://github.com/sinergiaestudio', 'La autoría no enlaza al perfil público.');
  await page.screenshot({ path: path.join(OUTPUT, 'home-light.png'), fullPage: true });

  await page.click('#themeExperienceButton');
  assert(await page.getAttribute('html', 'data-theme') === 'dark', 'El selector no activó el tema oscuro.');
  await page.screenshot({ path: path.join(OUTPUT, 'home-dark.png'), fullPage: true });
  await page.click('#themeExperienceButton');
  await page.click('#themeExperienceButton');
  assert(await page.getAttribute('html', 'data-theme') === 'light', 'El ciclo de temas no regresó al modo claro.');

  await page.fill('#individualForm input[name="participantName"]', 'Sofía Martínez');
  await page.fill('#individualForm input[name="eventTitle"]', 'Taller de herramientas digitales');
  await page.fill('#individualForm textarea[name="eventText"]', 'En reconocimiento por su participación en la actividad.');
  await page.click('#applyIndividualButton');
  await page.waitForSelector('#view-review.active');
  await page.waitForFunction(() => document.querySelector('#certificateCanvas')?.width === 1120);
  assert((await page.locator('#previewRecordName').textContent()).includes('Sofía Martínez'), 'La revisión no mostró el participante creado.');
  await page.screenshot({ path: path.join(OUTPUT, 'review.png'), fullPage: true });

  await page.click('#mainNav [data-view="export"]');
  await page.waitForSelector('#view-export.active');
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportCurrentPdfButton')
  ]);
  const pdf = await downloadedBytes(pdfDownload, 'sample.pdf');
  assert(pdf.bytes.subarray(0, 5).toString() === '%PDF-', 'El PDF exportado no contiene una cabecera válida.');

  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportZipButton')
  ]);
  const zip = await downloadedBytes(zipDownload, 'sample.zip');
  assert(zip.bytes[0] === 0x50 && zip.bytes[1] === 0x4b, 'El ZIP exportado no contiene una cabecera válida.');

  await page.click('#projectsExperienceButton');
  await page.waitForFunction(() => document.querySelector('#projectLibraryDialog')?.open === true);
  assert(await page.locator('#projectLibraryList .project-card').count() >= 1, 'La biblioteca no recuperó el proyecto guardado.');
  await page.locator('#projectLibraryDialog [data-experience-close]').click();

  await page.click('#mainNav [data-view="templates"]');
  await page.waitForSelector('#view-templates.active');
  await page.click('[data-studio-open]');
  await page.waitForSelector('#view-studio.active');
  assert(await page.locator('#studioCanvas').count() === 1, 'El Estudio de Plantillas no abrió su lienzo.');
  await page.screenshot({ path: path.join(OUTPUT, 'studio.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#mobileBottomNav [data-mobile-primary="home"]');
  await page.waitForSelector('#view-home.active');
  const sidebarDisplay = await page.locator('.sidebar').evaluate(node => getComputedStyle(node).display);
  const mobileNavDisplay = await page.locator('#mobileBottomNav').evaluate(node => getComputedStyle(node).display);
  assert(sidebarDisplay === 'none', 'La barra lateral de escritorio permanece visible en móvil.');
  assert(mobileNavDisplay === 'grid', 'La navegación inferior móvil no está visible.');
  await page.screenshot({ path: path.join(OUTPUT, 'mobile-home.png'), fullPage: true });

  await page.click('#mobileBottomNav [data-mobile-primary="more"]');
  await page.waitForFunction(() => document.querySelector('#mobileMoreSheet')?.open === true);
  await page.screenshot({ path: path.join(OUTPUT, 'mobile-more.png'), fullPage: true });

  const version = await page.evaluate(() => window.Diplomaker?.Experience?.version || 'desconocida');
  const results = {
    version,
    title,
    theme: 'light/dark/system',
    pdfBytes: pdf.bytes.length,
    zipBytes: zip.bytes.length,
    consoleErrors,
    pageErrors,
    passed: consoleErrors.length === 0 && pageErrors.length === 0
  };
  fs.writeFileSync(path.join(OUTPUT, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);

  assert(pageErrors.length === 0, `Errores JavaScript: ${pageErrors.join(' | ')}`);
  assert(consoleErrors.length === 0, `Errores de consola: ${consoleErrors.join(' | ')}`);

  await browser.close();
  console.log('Prueba integral de interfaz completada sin errores.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
