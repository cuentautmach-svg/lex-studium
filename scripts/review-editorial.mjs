import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Real browser captures of the existing public site and a local redesign.
// No requests or public records are changed. QA storage belongs to disposable contexts.
const base = (process.env.BASE_URL || 'http://127.0.0.1:4174').replace(/\/$/, '');
const before = process.env.BEFORE_URL || 'https://cuentautmach-svg.github.io/lex-studium/';
const output = resolve(process.env.OUTPUT_DIR || 'artifacts/editorial');
await mkdir(output, { recursive: true });
const report = {
  date: new Date().toISOString(), base, before,
  scope: 'Capturas reales de Chromium; catálogo de archivos consultado en GitHub sin simular datos. Pruebas funcionales en contextos locales desechables. Emulación de tamaños móviles, sin dispositivo físico.',
  screenshots: [], checks: [], layouts: [], contrast: [], errors: [], assetErrors: [], documents: null,
};
const pass = message => { report.checks.push(message); console.log('✓ ' + message); };
let browser, activePage;
async function session(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: 'es-EC', reducedMotion: 'reduce', ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1' });
  context.on('page', page => {
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
    page.on('requestfailed', request => {
      if (['font', 'script', 'stylesheet'].includes(request.resourceType())) report.assetErrors.push({ url: request.url(), message: request.failure()?.errorText });
    });
    page.on('response', response => {
      if (response.status() >= 400 && ['font', 'script', 'stylesheet'].includes(response.request().resourceType())) report.assetErrors.push({ url: response.url(), status: response.status() });
    });
  });
  return context;
}
async function ready(page, url = base) {
  await page.goto(url);
  await page.locator('#lawGrid .law-card').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(page, filename, { top = true, fullPage = false } = {}) {
  if (top) await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: resolve(output, filename), animations: 'disabled', fullPage });
  report.screenshots.push({ file: filename, url: page.url(), viewport: page.viewportSize(), fullPage, scrollY: await page.evaluate(() => scrollY) });
}
async function go(page, id) {
  await page.evaluate(id => goById(id), id);
  assert.equal(await page.locator(`#${id}`).evaluate(element => element.classList.contains('active')), true);
}
async function filesReady(page) {
  await page.locator('#lexTabFiles').click();
  await page.waitForFunction(() => !document.getElementById('lexDocsStatus').textContent.startsWith('Consultando'));
  return {
    status: await page.locator('#lexDocsStatus').textContent(),
    count: await page.locator('.lex-doc-card').count(),
    fallback: await page.locator('.lex-docs-empty').textContent().catch(() => null),
  };
}
async function layout(page, width, theme, section) {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const measured = await page.evaluate(() => {
    const overflow = Math.max(0, document.documentElement.scrollWidth - innerWidth);
    const clipped = overflow > 1 ? [...document.querySelectorAll('main *')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width && (box.left < -1 || box.right > innerWidth + 1);
    }).slice(0, 8).map(element => ({ tag: element.tagName, class: String(element.className?.baseVal ?? element.className) })) : [];
    const headerOverlaps = [];
    const controls = [...document.querySelectorAll('.brand,.account-shortcut,.theme-toggle')].map(element => ({ name: element.className, box: element.getBoundingClientRect() })).filter(({ box }) => box.width && box.height);
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i].box, b = controls[j].box;
      if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) headerOverlaps.push([controls[i].name, controls[j].name]);
    }
    return { overflow, clipped, headerOverlaps };
  });
  report.layouts.push({ width, theme, section, ...measured });
}
async function contrast(page, width, theme, section) {
  const measured = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const color = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); const data = ctx.getImageData(0, 0, 1, 1).data; return [data[0], data[1], data[2], data[3] / 255]; };
    const over = (front, back) => [...front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3])), 1];
    const luminance = rgb => { const values = rgb.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722; };
    const ratio = (front, back) => { const values = [luminance(front), luminance(back)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    const failures = []; let checked = 0;
    for (const element of document.querySelectorAll('body *')) {
      if (element.closest('[aria-hidden="true"],svg,script,style,[hidden]') || element.matches(':disabled') || element.closest(':disabled')) continue;
      const control = element.matches('input:not([type=checkbox]):not([type=radio]),select,textarea');
      const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(' ').trim();
      if (!control && !text) continue;
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!box.width || !box.height || style.visibility !== 'visible' || style.display === 'none') continue;
      let current = element, ancestors = [], unsupported = false;
      while (current) { const computed = getComputedStyle(current); if (Number(computed.opacity) < .99 || computed.backgroundImage !== 'none') unsupported = true; ancestors.push(computed); current = current.parentElement; }
      if (unsupported) continue;
      let background = [255, 255, 255, 1];
      for (const ancestor of ancestors.reverse()) background = over(color(ancestor.backgroundColor), background);
      const samples = [{ label: text || element.value || element.getAttribute('aria-label') || element.tagName, style, kind: 'texto' }];
      if (element.matches('input[placeholder],textarea[placeholder]') && !element.value) samples.push({ label: element.getAttribute('placeholder'), style: getComputedStyle(element, '::placeholder'), kind: 'placeholder' });
      for (const sample of samples) {
        if (!sample.label) continue;
        const foreground = color(sample.style.color); foreground[3] *= Number(sample.style.opacity || 1);
        const computed = ratio(over(foreground, background), background), size = parseFloat(sample.style.fontSize), weight = Number(sample.style.fontWeight) || 400;
        const threshold = size >= 24 || (size >= 18.666 && weight >= 700) ? 3 : 4.5; checked++;
        if (computed + .02 < threshold) failures.push({ selector: element.id ? '#' + element.id : '.' + String(element.className || '').trim().split(/\s+/).join('.'), text: sample.label.slice(0, 80), kind: sample.kind, ratio: Number(computed.toFixed(2)), threshold });
      }
    }
    return { checked, failures };
  });
  report.contrast.push({ width, theme, section, ...measured });
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  if (process.env.CAPTURE_BEFORE === '1') {
    const context = await session(), page = activePage = await context.newPage();
    await ready(page, before);
    await capture(page, 'antes-biblioteca-escritorio.png');
    await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'antes-biblioteca-movil.png');
    await context.close();
  }

  // Capture the real, empty local profile before functional tests store QA data.
  const context = await session(), page = activePage = await context.newPage();
  await ready(page);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.design), 'foro');
  await capture(page, 'despues-biblioteca-escritorio.png');
  await page.locator('#catalog').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await capture(page, 'despues-catalogo-escritorio.png', { top: false });
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'despues-biblioteca-movil.png');
  await capture(page, 'despues-biblioteca-movil-completa.png', { fullPage: true });
  report.documents = await filesReady(page);
  await capture(page, 'despues-archivos-movil.png');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'despues-archivos-escritorio.png');
  await page.locator('#lexTabLaws').click(); await page.locator('#themeToggle').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await capture(page, 'despues-oscuro-escritorio.png');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'despues-oscuro-movil.png');
  await page.locator('#themeToggle').click(); await go(page, 'perfil'); await capture(page, 'despues-perfil-movil.png');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'despues-perfil-escritorio.png');
  pass('Capturas reales de biblioteca, catálogo, archivos, modo oscuro y perfil; sin datos inventados ni simulación de GitHub');

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => applyTheme(theme), theme);
      for (const section of ['biblioteca', 'comunidad', 'perfil']) {
        await go(page, section); await layout(page, width, theme, section);
        if ([390, 1440].includes(width)) await contrast(page, width, theme, section);
      }
      await go(page, 'biblioteca'); await filesReady(page); await layout(page, width, theme, 'archivos');
      if ([390, 1440].includes(width)) await contrast(page, width, theme, 'archivos');
      await page.locator('#lexTabLaws').click();
      await page.locator('#libraryAdvanced > summary').click(); await layout(page, width, theme, 'filtros');
      await page.locator('#libraryAdvanced > summary').click();
    }
  }
  pass('Diseño adaptable medido a 360, 390, 768, 1024 y 1440 px, en ambos temas y con filtros abiertos');

  await page.evaluate(() => applyTheme('light')); await go(page, 'biblioteca');
  assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 6);
  await page.locator('#lawLoadMore').click(); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 12);
  await page.locator('#lawSearch').fill('codigo civil'); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 1);
  assert.match(await page.locator('.law-heading h3').textContent(), /Código Civil/);
  await page.locator('#lawSearch').fill('CÓDIGO CIVIL'); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 1);
  await page.locator('.law-details > summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.law-details').getAttribute('open'), '');
  assert.match(await page.locator('.law-details').textContent(), /reformas|revisión|vigencia|08\/11\/2026/i);
  for (const link of await page.locator('.law-card a').all()) assert.match(await link.getAttribute('href'), /^https:\/\//);
  await page.locator('.save-law').click(); assert.equal(await page.locator('.save-law').getAttribute('aria-pressed'), 'true');
  await page.reload(); await page.locator('#libraryAdvanced > summary').click();
  await page.locator('#lawSaved').selectOption('saved'); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 1);
  assert.match(await page.locator('.law-heading h3').textContent(), /Código Civil/);
  await page.locator('#lawSaved').selectOption('all'); await page.locator('#lawArea').selectOption('Civil');
  assert.ok(await page.locator('#lawGrid .law-card:visible').count() > 0);
  await page.locator('#lawArea').selectOption('Todas las áreas'); await page.locator('#lawType').selectOption('Código');
  assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 6);
  await page.locator('#lawType').selectOption('Todos los tipos');
  while (await page.locator('#lawLoadMore').isVisible()) await page.locator('#lawLoadMore').click();
  assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 41);
  await page.locator('#lawSearch').fill('inexistente-lex-prueba'); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 0);
  await page.locator('.empty .quiet-link').click(); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 6);
  pass('41 normas conservadas; búsqueda con y sin tildes, carga progresiva, filtros, favoritos persistentes, referencias y estado vacío');

  await page.locator('#lexTabLaws').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#lexTabFiles').getAttribute('aria-selected'), 'true');
  await page.waitForFunction(() => !document.getElementById('lexDocsStatus').textContent.startsWith('Consultando'));
  assert.ok((await page.locator('#lexDocsStatus').textContent()).trim());
  assert.match(await page.locator('.lex-docs-admin a').getAttribute('href'), /^https:\/\/github\.com\/cuentautmach-svg\/lex-studium\/upload\//);
  await page.locator('#lexDocsSearch').fill('inexistente-lex-qa');
  if (await page.evaluate(() => lexMaterialsLoaded)) assert.match(await page.locator('.lex-docs-empty').textContent(), /No encontramos/);
  await page.locator('#lexDocsSearch').fill(''); await page.locator('#lexTabFiles').focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#lexTabLaws').getAttribute('aria-selected'), 'true');
  await page.locator('.nav button[data-page="comunidad"]').focus(); await page.keyboard.press('Enter');
  assert.match(await page.locator('#comunidad').textContent(), /Próximamente/);
  await page.evaluate(() => goById('practicar'));
  assert.equal(await page.locator('#biblioteca').evaluate(element => element.classList.contains('active')), true);
  assert.equal(await page.locator('.nav button[data-page="practicar"]').isVisible(), false);
  await page.locator('#themeToggle').click(); await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await go(page, 'perfil'); await page.locator('#profileName').fill('Revisión local');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.reload(); assert.equal(await page.locator('#sideName').textContent(), 'Revisión local');
  pass('Pestañas y navegación por teclado, archivos reales, perfil y tema persistentes; simulador permanece pausado');
  await context.close();

  // Exercise the existing network-error recovery in a separate local context.
  const errorContext = await session(), errorPage = activePage = await errorContext.newPage();
  await errorContext.route('https://api.github.com/repos/cuentautmach-svg/lex-studium/git/trees/main?recursive=1', route => route.abort('failed'));
  await ready(errorPage); await filesReady(errorPage);
  assert.match(await errorPage.locator('#lexDocsStatus').textContent(), /no se pudo|reintentar/i);
  assert.match(await errorPage.locator('.lex-docs-empty a').getAttribute('href'), /^https:\/\/github\.com\//);
  await errorContext.close(); pass('El fallo de red de archivos ofrece reintento y enlace alternativo a GitHub');

  const overflow = report.layouts.filter(value => value.overflow > 1 || value.headerOverlaps.length);
  const contrastFailures = report.contrast.flatMap(value => value.failures.map(failure => ({ width: value.width, theme: value.theme, section: value.section, ...failure })));
  report.summary = { screenshots: report.screenshots.length, layoutMeasurements: report.layouts.length, layoutFailures: overflow.length, contrastSamples: report.contrast.reduce((sum, value) => sum + value.checked, 0), contrastFailures: contrastFailures.length, javascriptErrors: report.errors.length, assetErrors: report.assetErrors.length };
  assert.deepEqual(report.errors, [], 'Sin errores JavaScript');
  assert.deepEqual(report.assetErrors, [], 'Sin errores de fuentes, estilos o scripts');
  assert.deepEqual(overflow, [], 'Sin desbordamientos ni controles de cabecera superpuestos');
  assert.deepEqual(contrastFailures, [], 'Contraste de texto sobre fondos sólidos');
  pass('Sin errores JavaScript, recursos de interfaz fallidos, desbordamientos o fallos de contraste medidos');
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await activePage?.screenshot({ path: resolve(output, 'error-revision.png'), animations: 'disabled' }).catch(() => {});
  console.error(error.stack);
} finally {
  await browser?.close();
  await writeFile(resolve(output, 'verificacion-editorial.json'), JSON.stringify(report, null, 2));
}
