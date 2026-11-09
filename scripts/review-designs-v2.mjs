import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Static UI review only. No document backend, database, account or storage is used.
const base = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = new URL('../artifacts/diseno-v2/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { date: new Date().toISOString(), base, screenshots: [], checks: [], layouts: [], contrast: [], errors: [], assetErrors: [], scope: 'Interfaz estática; listado público de GitHub simulado. No se prueba ni se requiere el backend.' };
let browser, activePage;
const pass = text => { report.checks.push(text); console.log('✓ ' + text); };
const pathFor = name => fileURLToPath(new URL(name, output));

async function context(viewport = { width: 1280, height: 1000 }) {
  const result = await browser.newContext({ viewport, locale: 'es-EC', reducedMotion: 'reduce' });
  result.on('page', page => {
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
    page.on('requestfailed', request => {
      if (['font', 'script', 'stylesheet'].includes(request.resourceType())) report.assetErrors.push({ url: request.url(), error: request.failure()?.errorText });
    });
    page.on('response', response => {
      if (response.status() >= 400 && ['font', 'script', 'stylesheet'].includes(response.request().resourceType())) report.assetErrors.push({ url: response.url(), status: response.status() });
    });
  });
  await result.route('https://api.github.com/**', route => route.fulfill({ json: { tree: [], truncated: false } }));
  return result;
}
async function ready(page) {
  await page.locator('#lawGrid .law-card').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(page, concept, name) {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const filename = `${concept}-${name}.png`;
  await page.screenshot({ path: pathFor(filename), animations: 'disabled' });
  report.screenshots.push({ file: filename, concept, viewport: page.viewportSize(), url: page.url() });
}
async function go(page, section) {
  await page.evaluate(section => goById(section), section);
  assert.equal(await page.locator(`#${section}`).evaluate(element => element.classList.contains('active')), true);
}
async function step(page, index) {
  await page.locator(`[data-practice-jump="${index}"]`).click();
  const visible = page.locator('.practice-step:visible');
  assert.equal(await visible.count(), 1, 'Solo se muestra un paso del simulador');
  assert.equal(await visible.first().getAttribute('data-practice-step'), String(index));
}
async function measureLayout(page, concept, width, theme, section) {
  const measured = await page.evaluate(() => {
    const overflow = Math.max(0, document.documentElement.scrollWidth - innerWidth);
    const clipped = overflow > 1 ? [...document.querySelectorAll('main *')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
    }).slice(0, 8).map(element => ({ tag: element.tagName, class: String(element.className?.baseVal ?? element.className) })) : [];
    const headerOverlaps = [];
    if (innerWidth <= 600) {
      const controls = [...document.querySelectorAll('.brand,.account-shortcut,.theme-toggle')].map(element => ({ name: element.className, box: element.getBoundingClientRect() })).filter(({ box }) => box.width && box.height);
      for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i].box, b = controls[j].box;
        if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) headerOverlaps.push([controls[i].name, controls[j].name]);
      }
    }
    return { overflow, clipped, headerOverlaps };
  });
  report.layouts.push({ concept, width, theme, section, ...measured });
  assert.equal(measured.headerOverlaps.length, 0, 'Los controles de cabecera móvil no se superponen');
}
async function measureContrast(page, concept, width, theme, section) {
  const measured = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const color = value => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      return [data[0], data[1], data[2], data[3] / 255];
    };
    const over = (front, back) => [...front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3])), 1];
    const luminance = rgb => {
      const linear = rgb.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; });
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    };
    const ratio = (front, back) => { const values = [luminance(front), luminance(back)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    const failures = [], skipped = {}; let checked = 0, minimum = Infinity;
    const skip = reason => { skipped[reason] = (skipped[reason] || 0) + 1; };
    for (const element of document.querySelectorAll('body *')) {
      if (element.closest('[aria-hidden="true"],svg,script,style,[hidden]') || element.matches(':disabled') || element.closest(':disabled')) continue;
      const control = element.matches('input:not([type=checkbox]):not([type=radio]),select,textarea');
      const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(' ').trim();
      if (!control && !text) continue;
      const box = element.getBoundingClientRect(); const style = getComputedStyle(element);
      if (!box.width || !box.height || style.visibility !== 'visible' || style.display === 'none') continue;
      let current = element, ancestors = [], unsupported;
      while (current) {
        const currentStyle = getComputedStyle(current);
        if (Number(currentStyle.opacity) < .99) unsupported = 'transparencia de grupo';
        if (currentStyle.backgroundImage !== 'none') unsupported = 'fondo con imagen o degradado';
        ancestors.push(currentStyle); current = current.parentElement;
      }
      if (unsupported) { skip(unsupported); continue; }
      let background = [255, 255, 255, 1];
      for (const ancestor of ancestors.reverse()) background = over(color(ancestor.backgroundColor), background);
      const samples = [{ label: text || element.value || element.getAttribute('aria-label') || element.tagName, style, kind: 'texto' }];
      if (element.matches('input[placeholder],textarea[placeholder]') && !element.value) samples.push({ label: element.getAttribute('placeholder'), style: getComputedStyle(element, '::placeholder'), kind: 'placeholder' });
      for (const sample of samples) {
        if (!sample.label) continue;
        const foreground = color(sample.style.color); foreground[3] *= Number(sample.style.opacity || 1);
        const computed = ratio(over(foreground, background), background);
        const size = parseFloat(sample.style.fontSize) || parseFloat(style.fontSize);
        const weight = Number(sample.style.fontWeight) || 400;
        const threshold = size >= 24 || (size >= 18.666 && weight >= 700) ? 3 : 4.5;
        checked++; minimum = Math.min(minimum, computed);
        if (computed + .02 < threshold) failures.push({ tag: element.tagName, selector: element.id ? '#' + element.id : '.' + String(element.className || '').trim().split(/\s+/).join('.'), text: sample.label.slice(0, 100), kind: sample.kind, ratio: Number(computed.toFixed(2)), threshold, color: sample.style.color, background: background.slice(0, 3).map(Math.round), fontSize: size, fontWeight: weight });
      }
    }
    return { checked, minimum: Number.isFinite(minimum) ? Number(minimum.toFixed(2)) : null, skipped, failures };
  });
  report.contrast.push({ concept, width, theme, section, ...measured });
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  for (const concept of ['archivo', 'foro', 'orbita']) {
    const session = await context(); const page = activePage = await session.newPage();
    await page.goto(`${base}/?design=${concept}`); await ready(page);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.design), concept);
    assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 6, 'El catálogo muestra solo seis normas al inicio');
    await capture(page, concept, 'biblioteca-escritorio');
    await page.setViewportSize({ width: 390, height: 844 }); await capture(page, concept, 'biblioteca-movil');
    await go(page, 'practicar');
    assert.equal(await page.locator('.practice-step:visible').count(), 1);
    assert.equal(await page.locator('.practice-step:visible').getAttribute('data-practice-step'), '0');
    await capture(page, concept, 'simulador-movil');
    await page.setViewportSize({ width: 1280, height: 1000 }); await capture(page, concept, 'simulador-escritorio');
    await go(page, 'biblioteca'); await page.evaluate(() => applyTheme('dark'));
    await capture(page, concept, 'oscuro-escritorio');
    await page.setViewportSize({ width: 390, height: 844 }); await capture(page, concept, 'oscuro-movil');

    // Capture first. Then exercise all responsive states with real demo content.
    await go(page, 'practicar'); await page.getByRole('button', { name: 'Usar texto de ejemplo' }).click();
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => applyTheme(theme), theme);
        for (const section of ['biblioteca', 'comunidad', 'perfil']) {
          await go(page, section); await measureLayout(page, concept, width, theme, section);
          if ([390, 1280].includes(width)) await measureContrast(page, concept, width, theme, section);
        }
        await go(page, 'practicar'); await step(page, 0);
        for (const index of [0, 1, 2]) {
          if (index) await page.locator('#practiceNext').click();
          assert.equal(await page.locator('.practice-step:visible').getAttribute('data-practice-step'), String(index));
          await measureLayout(page, concept, width, theme, `simulador-${index + 1}`);
          if ([390, 1280].includes(width)) await measureContrast(page, concept, width, theme, `simulador-${index + 1}`);
        }
      }
    }
    await session.close(); pass(`${concept}: biblioteca y simulador capturados en escritorio/móvil; adaptación y temas revisados`);
  }

  const session = await context(); const page = activePage = await session.newPage();
  await page.goto(`${base}/?design=archivo`); await ready(page);
  await page.locator('#lawLoadMore').click(); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 12);
  await page.locator('#lawSearch').fill('Código Civil'); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 1);
  assert.ok((await page.locator('#libraryResultStatus').textContent()).trim());
  const details = page.locator('.law-details').first(); await details.locator('summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await details.getAttribute('open'), '');
  assert.match(await details.textContent(), /08\/11\/2026|revisión|vigencia|reformas/i);
  assert.match(await details.locator('a[href^="http"]').first().getAttribute('href'), /^https:\/\//);
  await page.locator('.save-law').click(); await page.reload();
  await page.locator('#libraryAdvanced > summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#libraryAdvanced').getAttribute('open'), '');
  await page.locator('#lawSaved').selectOption('saved'); assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 1);
  assert.match(await page.locator('.law-card h3').textContent(), /Código Civil/);
  await page.locator('#lawSaved').selectOption('all'); await page.locator('#lawArea').selectOption('Civil');
  assert.ok(await page.locator('#lawGrid .law-card:visible').count() > 0);
  await page.locator('#lawArea').selectOption('Todas las áreas'); await page.locator('#lawType').selectOption('Código');
  assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 6);
  await page.locator('#lawType').selectOption('Todos los tipos');
  while (await page.locator('#lawLoadMore').isVisible()) await page.locator('#lawLoadMore').click();
  assert.equal(await page.locator('#lawGrid .law-card:visible').count(), 41, 'Las 41 normas siguen disponibles a petición');
  await page.locator('#lawSearch').fill('inexistente-lex-prueba'); assert.equal(await page.locator('.law-card:visible').count(), 0);
  await page.locator('#lawSearch').fill(''); assert.equal(await page.locator('.law-card:visible').count(), 6);
  pass('Biblioteca: seis resultados iniciales, carga progresiva, búsqueda, filtros, referencias, estado vacío y favoritos persistentes');

  await go(page, 'practicar'); await page.locator('#practiceNext').click();
  assert.ok((await page.locator('#practiceFlowError').textContent()).trim());
  assert.equal(await page.locator('.practice-step:visible').getAttribute('data-practice-step'), '0');
  await page.getByRole('button', { name: 'Usar texto de ejemplo' }).click();
  const draft = await page.locator('#studyText').inputValue(); await page.reload(); await go(page, 'practicar');
  assert.equal(await page.locator('#studyText').inputValue(), draft);
  await page.locator('#practiceNext').click(); await page.locator('#range').fill('Contenido de ejemplo para revisión');
  await page.locator('#practiceNext').click();
  await page.locator('#count').selectOption('5'); await page.locator('#type').selectOption('mcq');
  assert.equal(await page.locator('#practiceAdvanced').getAttribute('open'), null);
  await page.locator('#practiceAdvanced > summary').focus(); await page.keyboard.press('Enter');
  await page.locator('#difficulty').selectOption('Media'); await page.locator('#practiceAdvanced > summary').click();
  await capture(page, 'archivo', 'simulador-configuracion-escritorio');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'archivo', 'simulador-configuracion-movil');
  const popup = page.waitForEvent('popup'); await page.getByRole('button', { name: /Generar evaluación/ }).click();
  const exam = activePage = await popup; await exam.waitForSelector('.exam-question');
  assert.equal(await exam.locator('.exam-question').count(), 5);
  await exam.evaluate(() => {
    const answer = window.__lexExam.questions[0].answer;
    [...document.querySelectorAll('input[name="sqn0"]')].find(input => input.value !== answer).click();
  });
  await exam.getByRole('button', { name: 'Corregir evaluación' }).click(); assert.equal(await exam.locator('.exam-question.wrong').count(), 1);
  await exam.evaluate(() => window.__lexExam.questions.forEach((question, index) => [...document.querySelectorAll(`input[name="sqn${index}"]`)].find(input => input.value === question.answer).click()));
  await exam.getByRole('button', { name: 'Corregir evaluación' }).click();
  assert.equal(await exam.locator('#standaloneScore').textContent(), '5 / 5'); assert.equal(await exam.locator('.exam-question.right').count(), 5);
  assert.equal(await exam.evaluate(() => JSON.parse(localStorage.getItem('lexData')).results[0].pct), 100);
  await exam.getByRole('button', { name: 'Mostrar respuestas' }).click(); assert.equal(await exam.locator('.exam-answer.show').count(), 5);
  await exam.setViewportSize({ width: 390, height: 844 }); await capture(exam, 'archivo', 'evaluacion-corregida-movil');
  await exam.close(); activePage = page;
  await page.evaluate(() => { window.open = () => null; }); await page.getByRole('button', { name: /Generar evaluación/ }).click();
  await page.locator('#standaloneExam').waitFor(); assert.equal(await page.locator('.exam-question').count(), 5);
  await page.goto(`${base}/?design=archivo`); await ready(page);
  pass('Simulador: validación inline, un paso visible, borrador, opciones avanzadas, evaluación, acierto/error, resultado, respuestas y alternativa sin ventana emergente');

  await page.locator('.nav button[data-page="comunidad"]').focus(); await page.keyboard.press('Enter');
  assert.match(await page.locator('#comunidad').textContent(), /Próximamente/);
  await go(page, 'biblioteca'); await page.locator('#lexTabLaws').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#lexTabFiles').getAttribute('aria-selected'), 'true'); await page.locator('.lex-docs-empty').waitFor();
  assert.match(await page.locator('.lex-docs-admin a').getAttribute('href'), /^https:\/\/github\.com\/[^/]+\/[^/]+\/upload\//);
  await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#lexTabLaws').getAttribute('aria-selected'), 'true');
  await page.locator('#themeToggle').click(); await page.reload(); assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.locator('#themeToggle').click(); await go(page, 'perfil'); await page.locator('#profileName').fill('Revisión de interfaz');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.reload(); assert.equal(await page.locator('#sideName').textContent(), 'Revisión de interfaz');
  assert.ok(await page.locator('#biblioteca').evaluate(element => getComputedStyle(element).animationDuration.split(',').every(value => parseFloat(value) <= .01)));
  report.fonts = await page.evaluate(() => [...document.fonts].map(font => ({ family: font.family, status: font.status })));
  await session.close(); pass('Navegación y pestañas con teclado, Comunidad, archivos existentes, tema y perfil persistentes, movimiento reducido y fuentes');

  const overflow = report.layouts.filter(layout => layout.overflow > 1);
  const contrast = report.contrast.flatMap(measurement => measurement.failures.map(failure => ({ concept: measurement.concept, width: measurement.width, theme: measurement.theme, section: measurement.section, ...failure })));
  report.summary = { captures: report.screenshots.length, layoutMeasurements: report.layouts.length, overflowFailures: overflow.length, contrastSamples: report.contrast.reduce((total, measurement) => total + measurement.checked, 0), contrastFailures: contrast.length, javascriptErrors: report.errors.length, assetErrors: report.assetErrors.length };
  assert.deepEqual(report.errors, [], 'Sin errores JavaScript'); assert.deepEqual(report.assetErrors, [], 'Sin errores de recursos de interfaz');
  assert.deepEqual(overflow, [], 'Sin desbordamientos horizontales');
  if (contrast.length) console.error('Contrastes a revisar:', JSON.stringify([...new Map(contrast.map(failure => [JSON.stringify([failure.concept, failure.theme, failure.selector, failure.kind, failure.ratio]), failure])).values()].slice(0, 12), null, 2));
  assert.equal(contrast.length, 0, 'Revisar contrastes medidos en verificacion.json; se conservan las capturas y los valores exactos');
  pass('Mediciones de diseño adaptable y contraste de texto sobre fondos sólidos sin fallos detectados');
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await activePage?.screenshot({ path: pathFor('error-revision.png'), animations: 'disabled' }).catch(() => {});
  console.error(error.stack);
} finally {
  await browser?.close();
  await writeFile(pathFor('verificacion.json'), JSON.stringify(report, null, 2));
}
