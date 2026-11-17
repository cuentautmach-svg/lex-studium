import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = (process.env.BASE_URL || 'http://127.0.0.1:4174').replace(/\/$/, '');
const output = resolve(process.env.OUTPUT_DIR || '/workspace/work/revision-campus/capturas');
await mkdir(output, { recursive: true });
const report = {
  date: new Date().toISOString(), base,
  scope: 'Capturas reales de Chromium con contenido local y archivos consultados en GitHub, sin datos simulados. Pruebas funcionales en contextos desechables. Móvil emulado, sin dispositivo físico.',
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
      if (['font', 'script', 'stylesheet', 'image'].includes(request.resourceType())) report.assetErrors.push({ url: request.url(), message: request.failure()?.errorText });
    });
    page.on('response', response => {
      if (response.status() >= 400 && ['font', 'script', 'stylesheet', 'image'].includes(response.request().resourceType())) report.assetErrors.push({ url: response.url(), status: response.status() });
    });
  });
  return context;
}
async function ready(page, url = base) {
  await page.goto(url);
  await page.locator('#lawGrid .catalog-entry').first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
  });
}
async function capture(page, filename, { top = true, fullPage = false } = {}) {
  if (top) await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: resolve(output, filename), animations: 'disabled', fullPage });
  report.screenshots.push({ file: filename, url: page.url(), viewport: page.viewportSize(), fullPage, scrollY: await page.evaluate(() => scrollY) });
}
async function navigate(page, section) {
  if (page.viewportSize().width <= 1100 && !(await page.locator('body').evaluate(element => element.classList.contains('menu-open')))) await page.locator('#menuToggle').click();
  await page.locator(`.campus-nav button[data-section="${section}"]`).click();
  assert.equal(await page.locator('body').evaluate(element => element.classList.contains('menu-open')), false);
  assert.equal(await page.locator(`.campus-nav button[data-section="${section}"]`).getAttribute('aria-current'), 'page');
}
async function filesReady(page, viaNavigation = true) {
  if (viaNavigation) await navigate(page, 'archivos');
  await page.waitForFunction(() => !document.getElementById('lexDocsStatus').textContent.startsWith('Consultando'));
  return {
    status: await page.locator('#lexDocsStatus').textContent(),
    count: await page.locator('.lex-doc-card').count(),
    fallback: await page.locator('.lex-docs-empty').textContent().catch(() => null),
  };
}
async function leaveRecord(page, key = false) {
  if (!(await page.locator('#catalog').evaluate(element => element.classList.contains('reading')))) return;
  if (key) await page.keyboard.press('Escape'); else await page.locator('.record-back').click();
  await page.waitForFunction(() => !document.getElementById('catalog').classList.contains('reading') && !history.state?.lexRecord);
}
async function filters(page, open = true) {
  if ((await page.locator('#libraryAdvanced').getAttribute('open') !== null) !== open) await page.locator('#libraryAdvanced > summary').click();
}
async function layout(page, width, theme, section) {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const measured = await page.evaluate(() => {
    const overflow = Math.max(0, document.documentElement.scrollWidth - innerWidth);
    const clipped = overflow > 1 ? [...document.querySelectorAll('main *')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width && (box.left < -1 || box.right > innerWidth + 1);
    }).slice(0, 10).map(element => ({ tag: element.tagName, class: String(element.className?.baseVal ?? element.className) })) : [];
    const headerOverlaps = [];
    const controls = [...document.querySelectorAll('.mobile-brand,#menuToggle')].map(element => ({ name: element.className, box: element.getBoundingClientRect() })).filter(({ box }) => box.width && box.height);
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
      if (element.closest('[aria-hidden="true"],svg,script,style,[hidden],[inert]') || element.matches(':disabled') || element.closest(':disabled')) continue;
      const control = element.matches('input:not([type=checkbox]):not([type=radio]),select,textarea');
      const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(' ').trim();
      if (!control && !text) continue;
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!box.width || !box.height || style.visibility !== 'visible' || style.display === 'none' || box.right <= 0 || box.left >= innerWidth) continue;
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
  const context = await session(), page = activePage = await context.newPage();
  await ready(page);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.design), 'campus');
  assert.match(await page.locator('#recordTitle').textContent(), /Constitución de la República/);
  await capture(page, 'despues-biblioteca-escritorio.png');
  await page.locator('.catalog-select[data-law-index="2"]').click();
  assert.match(await page.locator('#recordTitle').textContent(), /Integral Penal/);
  await capture(page, 'despues-ficha-coip-escritorio.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'despues-biblioteca-movil.png');
  await capture(page, 'despues-biblioteca-movil-completa.png', { fullPage: true });
  await page.locator('.catalog-select[data-law-index="2"]').click();
  await capture(page, 'despues-ficha-coip-movil.png'); await leaveRecord(page);
  await page.locator('#menuToggle').click(); await capture(page, 'despues-menu-movil.png'); await page.locator('#menuClose').click();
  await page.evaluate(() => applyTheme('dark')); await capture(page, 'despues-oscuro-movil.png');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'despues-oscuro-escritorio.png');
  await page.evaluate(() => applyTheme('light'));
  report.documents = await filesReady(page); await capture(page, 'despues-archivos-escritorio.png');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'despues-archivos-movil.png');
  await navigate(page, 'perfil'); await capture(page, 'despues-perfil-movil.png');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'despues-perfil-escritorio.png');
  await navigate(page, 'guardadas'); await capture(page, 'despues-lecturas-vacias-escritorio.png');
  pass('Capturas reales de nueva biblioteca, ficha COIP, menú móvil, archivos, modo oscuro, perfil y lecturas vacías');

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => applyTheme(theme), theme);
      await navigate(page, 'leyes'); await layout(page, width, theme, 'catalogo');
      if ([390, 1440].includes(width)) await contrast(page, width, theme, 'catalogo');
      await filters(page); await layout(page, width, theme, 'filtros'); await filters(page, false);
      await page.locator('.catalog-select[data-law-index="2"]').click(); await layout(page, width, theme, 'ficha');
      if ([390, 1440].includes(width)) await contrast(page, width, theme, 'ficha');
      await leaveRecord(page);
      await filesReady(page); await layout(page, width, theme, 'archivos');
      if ([390, 1440].includes(width)) await contrast(page, width, theme, 'archivos');
      await navigate(page, 'perfil'); await layout(page, width, theme, 'perfil');
      if ([390, 1440].includes(width)) await contrast(page, width, theme, 'perfil');
      await navigate(page, 'comunidad'); await layout(page, width, theme, 'comunidad');
      if ([390, 1440].includes(width)) await contrast(page, width, theme, 'comunidad');
      if (width <= 1100) {
        await page.locator('#menuToggle').click(); await layout(page, width, theme, 'menu');
        if (width === 390) await contrast(page, width, theme, 'menu');
        await page.keyboard.press('Escape');
      }
    }
  }
  pass('Catálogo, ficha, filtros, archivos, perfil, comunidad y menú medidos a 360, 390, 768, 1024 y 1440 px en ambos temas');

  // Exercise the new desktop composition through the actual controls.
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.evaluate(() => applyTheme('light')); await navigate(page, 'leyes');
  assert.equal(await page.locator('#lawGrid .catalog-entry').count(), 6);
  await page.locator('.catalog-select[data-law-index="2"]').click();
  assert.match(await page.locator('#recordTitle').textContent(), /Integral Penal/);
  assert.equal(await page.locator('.record-source').getAttribute('href'), await page.evaluate(() => lawSources[2].url));
  assert.equal(await page.locator('#catalog').evaluate(element => element.classList.contains('reading')), false);
  await page.locator('.record-reference > summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.record-reference').getAttribute('open'), '');
  assert.equal(await page.locator('.record-reference .law-note').textContent(), await page.evaluate(() => lawSources[2].note));
  for (const link of await page.locator('.record-actions a').all()) {
    assert.match(await link.getAttribute('href'), /^https:\/\//); assert.equal(await link.getAttribute('target'), '_blank'); assert.match(await link.getAttribute('rel'), /noopener/);
  }
  for (const [area, count] of [['Civil', 3], ['Constitucional', 4], ['Tecnología', 3]]) {
    if (!(await page.locator(`#areaIndex button[data-area="${area}"]`).count())) await page.locator('#areaIndexMore').click();
    await page.locator(`#areaIndex button[data-area="${area}"]`).click();
    assert.equal(await page.locator('.catalog-entry').count(), count); assert.equal(await page.locator('#lawArea').inputValue(), area);
    assert.match(await page.locator('#libraryResultStatus').textContent(), new RegExp(`${count} de ${count} normas`));
  }
  await navigate(page, 'leyes'); await filters(page); await page.locator('#lawType').selectOption('Código');
  assert.equal(await page.locator('.catalog-entry').count(), 6); assert.match(await page.locator('#libraryResultStatus').textContent(), /6 de 14 normas/);
  await page.locator('#libraryReset').click(); await filters(page, false);
  await page.locator('#lawSearch').fill('codigo civil'); assert.equal(await page.locator('.catalog-entry').count(), 1);
  assert.match(await page.locator('#recordTitle').textContent(), /Código Civil/);
  assert.equal(await page.locator('.record-pdf').getAttribute('href'), await page.evaluate(() => lawSources[1].pdf));
  await page.locator('#lawSearch').fill('PROTECCION DATOS'); assert.equal(await page.locator('.catalog-entry').count(), 1);
  assert.match(await page.locator('#recordTitle').textContent(), /Protección de Datos/);
  await page.locator('#lawSearch').fill('inexistente-lex-qa'); assert.equal(await page.locator('.catalog-entry').count(), 0);
  assert.equal(await page.locator('.record-empty').count(), 1); assert.equal(await page.locator('.record-source').count(), 0);
  await page.locator('.catalog-empty button').click();
  while (await page.locator('#lawLoadMore').isVisible()) await page.locator('#lawLoadMore').click();
  assert.equal(await page.locator('.catalog-entry').count(), 41);
  pass('41 normas y referencias preservadas; selección por índice original, materias y conteos, búsqueda sin tildes, filtros, PDF y estados vacíos');

  await page.locator('#lawSearch').fill('codigo civil');
  await page.locator('.save-law').click(); assert.equal(await page.locator('.save-law').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#savedNavCount').textContent(), '1');
  await page.reload(); await navigate(page, 'guardadas');
  assert.equal(await page.locator('.catalog-entry').count(), 1); assert.match(await page.locator('#recordTitle').textContent(), /Código Civil/);
  await page.locator('#detailSave').click(); assert.equal(await page.locator('.catalog-entry').count(), 0);
  assert.equal(await page.locator('#savedNavCount').textContent(), '0'); assert.equal(await page.locator('.record-empty').count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.closest('.record-empty') !== null), true);
  await page.locator('.catalog-empty button').click(); assert.equal(await page.locator('.catalog-entry').count(), 6);
  pass('Guardar desde catálogo, persistencia, Mis lecturas y retirada de la última lectura actualizan ficha, conteo, foco y estado vacío');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('#campusNavigation').evaluate(element => element.inert), true);
  await page.locator('.catalog-select[data-law-index="2"]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#catalog').evaluate(element => element.classList.contains('reading')), true);
  assert.match(await page.locator('#recordTitle').textContent(), /Integral Penal/);
  assert.equal(await page.locator('#catalogToolbar').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'recordTitle');
  assert.equal(await page.evaluate(() => history.state.lexRecord), true);
  await leaveRecord(page, true);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.lawIndex), '2');
  await page.locator('.catalog-select[data-law-index="1"]').click(); await page.goBack();
  await page.waitForFunction(() => !document.getElementById('catalog').classList.contains('reading'));
  assert.equal(await page.locator('#catalogToolbar').isVisible(), true);
  await page.locator('#menuToggle').click(); assert.equal(await page.locator('#campusNavigation').evaluate(element => element.inert), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menuClose');
  await page.locator('#menuClose').focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.closest('#campusNavigation') !== null), true);
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'menuClose');
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'menuToggle');
  await page.locator('#menuToggle').click(); await page.locator('#areaIndex button[data-area="Civil"]').click();
  assert.equal(await page.locator('.catalog-entry').count(), 3); assert.equal(await page.locator('body').evaluate(element => element.classList.contains('menu-open')), false);
  await navigate(page, 'leyes'); await page.locator('.catalog-select[data-law-index="2"]').click();
  await navigate(page, 'comunidad'); await page.getByRole('button', { name: 'Explorar la biblioteca' }).click();
  assert.equal(await page.locator('#catalogToolbar').isVisible(), true); assert.equal(await page.locator('.library-heading').isVisible(), true);
  await page.locator('.catalog-select[data-law-index="2"]').click(); await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => !document.getElementById('catalog').classList.contains('reading'));
  assert.equal(await page.locator('#catalogToolbar').isVisible(), true); assert.equal(await page.locator('#campusNavigation').evaluate(element => element.inert), false);
  assert.equal(await page.evaluate(() => Boolean(history.state?.lexRecord)), false);
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#menuToggle').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => !document.body.classList.contains('menu-open'));
  assert.equal(await page.locator('#menuBackdrop').isVisible(), false);
  pass('Ficha móvil con teclado/Escape/atrás y retorno de foco; menú con foco contenido, cierre al navegar y cambios de ancho sin bloqueos');

  await filesReady(page);
  assert.ok((await page.locator('#lexDocsStatus').textContent()).trim());
  assert.match(await page.locator('.lex-docs-admin a').getAttribute('href'), /^https:\/\/github\.com\/cuentautmach-svg\/lex-studium\/upload\//);
  await page.locator('#lexDocsSearch').fill('inexistente-lex-qa');
  if (await page.evaluate(() => lexMaterialsLoaded)) assert.match(await page.locator('.lex-docs-empty').textContent(), /No encontramos/);
  await page.locator('#lexDocsSearch').fill('');
  await page.locator('#themeToggle').click(); await page.reload(); assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await navigate(page, 'perfil'); await page.locator('#profileName').fill('Revisión local');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.reload(); assert.equal(await page.locator('#sideName').textContent(), 'Revisión local');
  await page.evaluate(() => goById('practicar')); assert.equal(await page.locator('#biblioteca').evaluate(element => element.classList.contains('active')), true);
  assert.equal(await page.locator('#practicar').isVisible(), false);
  await context.close(); pass('Archivos reales, navegación, tema/perfil persistentes y simulador todavía pausado');

  const errorContext = await session(), errorPage = activePage = await errorContext.newPage();
  await errorContext.route('https://api.github.com/repos/cuentautmach-svg/lex-studium/git/trees/main?recursive=1', route => route.abort('failed'));
  await ready(errorPage); await filesReady(errorPage);
  assert.match(await errorPage.locator('#lexDocsStatus').textContent(), /no se pudo|reintentar/i);
  assert.match(await errorPage.locator('.lex-docs-empty a').getAttribute('href'), /^https:\/\/github\.com\//);
  await errorContext.close(); pass('Un fallo de red en materiales conserva reintento y acceso alternativo a GitHub');

  const layoutFailures = report.layouts.filter(value => value.overflow > 1 || value.headerOverlaps.length);
  const contrastFailures = report.contrast.flatMap(value => value.failures.map(failure => ({ width: value.width, theme: value.theme, section: value.section, ...failure })));
  report.summary = { screenshots: report.screenshots.length, layoutMeasurements: report.layouts.length, layoutFailures: layoutFailures.length, contrastSamples: report.contrast.reduce((sum, value) => sum + value.checked, 0), contrastFailures: contrastFailures.length, javascriptErrors: report.errors.length, assetErrors: report.assetErrors.length };
  assert.deepEqual(report.errors, [], 'Sin errores JavaScript'); assert.deepEqual(report.assetErrors, [], 'Sin errores de fuentes, estilos, scripts o imágenes');
  assert.deepEqual(layoutFailures, [], 'Sin desbordamientos ni controles de cabecera superpuestos');
  assert.deepEqual(contrastFailures, [], 'Contraste de texto sobre fondos sólidos');
  pass('Sin errores JavaScript, recursos fallidos, desbordamientos ni fallos de contraste medidos');
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await activePage?.screenshot({ path: resolve(output, 'error-revision.png'), animations: 'disabled' }).catch(() => {});
  console.error(error.stack);
} finally {
  await browser?.close();
  await writeFile(resolve(output, 'verificacion-campus.json'), JSON.stringify(report, null, 2));
}
