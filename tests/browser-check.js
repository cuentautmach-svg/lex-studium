import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/password.js';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(rootDir, 'artifacts');
const dataDir = await mkdtemp(path.join(tmpdir(), 'lex-browser-'));
const password = randomBytes(24).toString('base64url');
const server = http.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const app = await createApp({ rootDir, dataDir, publicOrigin: origin, passwordHash: await hashPassword(password) });
server.on('request', app.handler);
let browser;
const errors = [];
const completed = [];
const check = name => { completed.push(name); console.log('✓ ' + name); };

function samplePDF() {
  const content = 'BT /F1 16 Tf 50 750 Td (Lex Studium - Documento de prueba local) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
try {
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.route('https://api.github.com/**', route => route.fulfill({ json: { tree: [], truncated: false } }));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  assert.equal(await page.locator('.law-card').count(), 41);
  await page.screenshot({ path: path.join(artifacts, 'biblioteca-escritorio.png') });
  await page.locator('#lawSearch').fill('Código Civil');
  assert.equal(await page.locator('.law-card').count(), 1);
  await page.locator('.save-law').click();
  await page.reload();
  await page.locator('#lawSaved').selectOption('saved');
  assert.equal(await page.locator('.law-card').count(), 1);
  assert.match(await page.locator('.law-card h3').textContent(), /Código Civil/);
  await page.locator('#lawSaved').selectOption('all');
  check('Biblioteca: 41 fichas, filtros y favoritos conservados tras recargar');

  await page.locator('[data-page="practicar"]').click();
  await page.getByRole('button', { name: 'Usar texto de ejemplo' }).click();
  const draft = await page.locator('#studyText').inputValue();
  await page.reload();
  await page.locator('[data-page="practicar"]').click();
  assert.equal(await page.locator('#studyText').inputValue(), draft);
  await page.locator('#type').selectOption('mcq');
  await page.locator('#count').selectOption('5');
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Generar evaluación/ }).click();
  const exam = await popupEvent;
  await exam.waitForSelector('.exam-question');
  assert.equal(await exam.locator('.exam-question').count(), 5);
  await exam.evaluate(() => window.__lexExam.questions.forEach((question, index) => {
    const answer = [...document.querySelectorAll(`input[name="sqn${index}"]`)].find(input => input.value === question.answer);
    answer.click();
  }));
  await exam.getByRole('button', { name: 'Corregir evaluación' }).click();
  assert.equal(await exam.locator('#standaloneScore').textContent(), '5 / 5');
  assert.equal(await exam.evaluate(() => JSON.parse(localStorage.getItem('lexData')).results[0].pct), 100);
  await exam.close();
  check('Simulador: borrador persistente, examen, corrección y resultado local');

  await page.locator('[data-page="comunidad"]').click();
  assert.match(await page.locator('#comunidad').textContent(), /Próximamente/);
  check('Comunidad continúa como Próximamente');
  await page.locator('[data-page="biblioteca"]').click();
  await page.locator('#lexTabFiles').click();
  await page.waitForFunction(() => document.querySelector('#lexDocsStatus').textContent.includes('archivos disponibles'));
  await page.locator('#lexAdminPanel summary').click();
  await page.locator('#lexAdminPassword').fill('contraseña-incorrecta');
  await page.locator('#lexAdminLogin button').click();
  await page.waitForFunction(() => document.querySelector('#lexAdminStatus').textContent.includes('no es correcta'));
  await page.locator('#lexAdminPassword').fill(password);
  await page.locator('#lexAdminLogin button').click();
  await page.locator('#lexUploadForm').waitFor({ state: 'visible' });
  const pdf = samplePDF();
  await page.locator('#lexDocumentTitle').fill('Guía de Derecho Civil — prueba local');
  await page.locator('#lexDocumentDescription').fill('Documento utilizado únicamente para comprobar la carga y descarga en esta vista previa.');
  await page.locator('#lexDocumentFile').setInputFiles({ name: 'Guía civil.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.locator('#lexPublishConsent').check();
  const uploadResponsePromise = page.waitForResponse(response => response.url() === origin + '/api/documents' && response.request().method() === 'POST');
  await page.locator('#lexUploadSubmit').click();
  const uploadResponse = await uploadResponsePromise;
  assert.equal(uploadResponse.status(), 201, await uploadResponse.text());
  await page.waitForFunction(() => document.querySelector('#lexUploadStatus').textContent.includes('Documento publicado'));
  assert.equal(await page.locator('.lex-doc-card').count(), 1);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: path.join(artifacts, 'documentos-administracion.png'), fullPage: true });
  const downloadEvent = page.waitForEvent('download');
  await page.locator('.lex-doc-card a[download]').click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'Guía civil.pdf');
  assert.deepEqual(await readFile(await download.path()), pdf);
  await page.reload();
  await page.locator('#lexTabFiles').click();
  await page.locator('.lex-doc-card').waitFor();
  await page.locator('#lexAdminPanel summary').click();
  await page.locator('#lexUploadForm').waitFor({ state: 'visible' });
  await page.locator('#lexAdminLogout').click();
  await page.locator('#lexAdminLogin').waitFor({ state: 'visible' });
  check('Administración real: contraseña, carga PDF, persistencia, descarga y cierre de sesión');

  const visitor = await browser.newContext();
  await visitor.route('https://api.github.com/**', route => route.fulfill({ json: { tree: [] } }));
  const publicPage = await visitor.newPage();
  await publicPage.goto(origin);
  await publicPage.locator('#lexTabFiles').click();
  await publicPage.locator('.lex-doc-card').waitFor();
  const publicDownload = publicPage.waitForEvent('download');
  await publicPage.locator('.lex-doc-card a[download]').click();
  assert.deepEqual(await readFile(await (await publicDownload).path()), pdf);
  await visitor.close();
  check('Visitante sin sesión puede consultar y descargar el archivo');

  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of ['biblioteca', 'practicar', 'comunidad']) {
      await page.locator(`[data-page="${section}"]`).click();
      if (section === 'biblioteca') await page.locator('#lexTabLaws').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Desbordamiento en ${section}, ${width}px`);
      if (section === 'biblioteca' && width === 360) await page.screenshot({ path: path.join(artifacts, 'biblioteca-movil.png') });
    }
    await page.locator('[data-page="biblioteca"]').click();
    await page.locator('#lexTabFiles').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Desbordamiento archivos ${width}px`);
    if (width === 360) {
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(artifacts, 'documentos-movil.png'), fullPage: true });
    }
  }
  await page.locator('#themeToggle').click();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: path.join(artifacts, 'documentos-oscuro.png'), fullPage: true });
  const background = await page.locator('.lex-doc-card').evaluate(element => getComputedStyle(element).backgroundColor);
  assert.notEqual(background, 'rgb(255, 255, 255)');
  const duration = await page.locator('#biblioteca').evaluate(element => getComputedStyle(element).animationDuration);
  assert.ok(duration.split(',').every(value => parseFloat(value) <= .01), 'Respeta movimiento reducido');
  check('Diseño: 360, 768 y 1280px sin desbordamiento; tema oscuro y movimiento reducido');

  const staticContext = await browser.newContext();
  await staticContext.route(`${origin}/api/**`, route => route.fulfill({ status: 404, json: {} }));
  await staticContext.route('https://api.github.com/**', route => route.fulfill({ json: { tree: [{ type: 'blob', path: 'materiales/Derecho Civil/apuntes-previos.pdf', size: 1024 }] } }));
  const staticPage = await staticContext.newPage();
  await staticPage.goto(origin);
  await staticPage.locator('#lexTabFiles').click();
  await staticPage.locator('.lex-doc-card').waitFor();
  assert.match(await staticPage.locator('.lex-doc-name').textContent(), /apuntes previos/);
  await staticPage.locator('#lexAdminPanel summary').click();
  await staticPage.locator('#lexGithubUpload').waitFor({ state: 'visible' });
  await staticPage.locator('#lexTabFiles').focus();
  await staticPage.keyboard.press('ArrowLeft');
  assert.equal(await staticPage.locator('#lexTabLaws').getAttribute('aria-selected'), 'true');
  await staticContext.close();
  check('Modo estático: conserva archivos GitHub y carga anterior; pestañas con teclado');
  assert.deepEqual(errors, [], 'Sin errores JavaScript');
  await writeFile(path.join(artifacts, 'verificacion-navegador.json'), JSON.stringify({ date: new Date().toISOString(), checks: completed, errors }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  app.close();
  await rm(dataDir, { recursive: true, force: true });
}
