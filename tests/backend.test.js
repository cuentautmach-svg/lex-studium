import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import CFB from 'cfb';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/password.js';
import { MAX_FILE_BYTES, validateDocument } from '../server/validate-document.js';

const origin = 'http://localhost:3000';
const password = 'una contraseña local de pruebas 2026';
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

function officeZip(extension, extra = []) {
  const container = CFB.utils.cfb_new();
  const name = extension === 'docx' ? 'word/document.xml' : 'ppt/presentation.xml';
  const type = extension === 'docx' ? 'wordprocessingml.document' : 'presentationml.presentation';
  const xml = extension === 'docx' ? '<w:document xmlns:w="word"/>' : '<p:presentation xmlns:p="ppt"/>';
  CFB.utils.cfb_add(container, '[Content_Types].xml', Buffer.from(`<Types><Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.${type}.main+xml"/></Types>`));
  CFB.utils.cfb_add(container, name, Buffer.from(xml.replace('/>', '></' + (extension === 'docx' ? 'w:document' : 'p:presentation') + '>')));
  for (const [entry, content] of extra) CFB.utils.cfb_add(container, entry, Buffer.from(content));
  return CFB.write(container, { type: 'buffer', fileType: 'zip', compression: true });
}
function legacyOffice(extension) {
  const container = CFB.utils.cfb_new();
  CFB.utils.cfb_add(container, extension === 'doc' ? 'WordDocument' : 'PowerPoint Document', Buffer.from('Office test stream'));
  return CFB.write(container, { type: 'buffer', fileType: 'cfb' });
}
async function startApp(dataDir, hash, production = false) {
  const app = await createApp({ rootDir: process.cwd(), dataDir, publicOrigin: production ? 'https://lex.example' : origin, passwordHash: hash, production });
  const server = http.createServer(app.handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    app, server, base: `http://127.0.0.1:${server.address().port}`,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); app.close(); },
  };
}
async function login(base, value = password, requestOrigin = origin) {
  const response = await fetch(base + '/api/admin/login', { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }) });
  const body = await response.json();
  return { response, body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
function upload(base, credentials, filename, bytes, additional = {}) {
  const form = new FormData();
  form.set('title', 'Material <de prueba>');
  form.set('description', 'Descripción pública de prueba');
  form.set('file', new Blob([bytes]), filename);
  return fetch(base + '/api/documents', {
    method: 'POST', headers: { Origin: origin, Cookie: credentials.cookie || '', 'X-CSRF-Token': credentials.body?.csrfToken || '', ...additional }, body: form,
  });
}

test('valida formatos reales y rechaza extensiones falsas y contenido activo', async () => {
  assert.equal(await validateDocument(pdf, 'material.pdf'), 'pdf');
  assert.equal(await validateDocument(officeZip('docx'), 'material.docx'), 'docx');
  assert.equal(await validateDocument(officeZip('pptx'), 'clase.pptx'), 'pptx');
  assert.equal(await validateDocument(legacyOffice('doc'), 'guía.doc'), 'doc');
  assert.equal(await validateDocument(legacyOffice('ppt'), 'clase.ppt'), 'ppt');
  await assert.rejects(validateDocument(Buffer.from('<script>bad</script>'), 'falso.pdf'));
  await assert.rejects(validateDocument(officeZip('docx'), 'falso.pptx'));
  await assert.rejects(validateDocument(legacyOffice('doc'), 'falso.ppt'));
  await assert.rejects(validateDocument(officeZip('docx', [['word/vbaProject.bin', 'macro']]), 'macro.docx'));
  await assert.rejects(validateDocument(pdf, 'programa.exe'));
  await assert.rejects(validateDocument(Buffer.alloc(MAX_FILE_BYTES + 1), 'grande.pdf'));
  const damaged = officeZip('docx').subarray(0, 80);
  await assert.rejects(validateDocument(damaged, 'dañado.docx'));
});

test('API protege administración, conserva archivos y permite consulta pública', async t => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'lex-backend-test-'));
  const hash = await hashPassword(password);
  let running = await startApp(dataDir, hash);
  t.after(async () => { await running.close(); await rm(dataDir, { recursive: true, force: true }); });

  assert.deepEqual(await (await fetch(running.base + '/api/documents')).json(), { documents: [] });
  assert.deepEqual(await (await fetch(running.base + '/api/admin/session')).json(), { configured: true, authenticated: false });
  assert.equal((await upload(running.base, {}, 'prueba.pdf', pdf)).status, 401);
  assert.equal((await login(running.base, password, 'https://evil.example')).response.status, 403);
  assert.equal((await login(running.base, 'incorrecta')).response.status, 401);

  const credentials = await login(running.base);
  assert.equal(credentials.response.status, 200);
  assert.equal(credentials.body.authenticated, true);
  assert.match(credentials.response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.ok(credentials.body.csrfToken);
  assert.equal((await upload(running.base, credentials, 'prueba.pdf', pdf, { 'X-CSRF-Token': '' })).status, 403);
  assert.equal((await upload(running.base, credentials, 'prueba.pdf', pdf, { Origin: 'https://evil.example' })).status, 403);
  const malformedBoundary = 'lex-malformed-boundary';
  const malformed = await fetch(running.base + '/api/documents', {
    method: 'POST',
    headers: { Origin: origin, Cookie: credentials.cookie, 'X-CSRF-Token': credentials.body.csrfToken, 'Content-Type': `multipart/form-data; boundary=${malformedBoundary}` },
    body: `--${malformedBoundary}\r\nContent-Disposition: form-data; name="file"\r\nContent-Type: application/octet-stream\r\n\r\nmissing filename\r\n--${malformedBoundary}--\r\n`,
  });
  assert.equal(malformed.status, 400, 'un archivo sin nombre debe fallar sin terminar el servidor');
  assert.equal((await upload(running.base, credentials, 'falso.pdf', Buffer.from('no es PDF'))).status, 400);
  assert.equal((await upload(running.base, credentials, 'demasiado.pdf', Buffer.alloc(MAX_FILE_BYTES + 1))).status, 413);
  assert.deepEqual(await readdir(path.join(dataDir, 'documents')), []);

  // Simulate a catalog write failure after the file reached storage: no orphan remains.
  const database = new DatabaseSync(path.join(dataDir, 'lex-studium.sqlite'));
  database.exec("CREATE TRIGGER fail_document BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT, 'simulated failure'); END");
  assert.equal((await upload(running.base, credentials, 'fallo.pdf', pdf)).status, 500);
  assert.deepEqual(await readdir(path.join(dataDir, 'documents')), []);
  database.exec('DROP TRIGGER fail_document');
  database.close();

  const response = await upload(running.base, credentials, 'Código jurídico «I».pdf', pdf);
  assert.equal(response.status, 201);
  const document = (await response.json()).document;
  assert.equal(document.filename, 'Código jurídico «I».pdf');
  assert.equal(document.title, 'Material <de prueba>');
  const download = await fetch(running.base + document.downloadUrl);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.match(download.headers.get('content-disposition'), /filename\*=UTF-8''/);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
  assert.match((await fetch(running.base + document.viewUrl)).headers.get('content-disposition'), /^inline;/);
  assert.equal((await (await fetch(running.base + '/api/documents')).json()).documents.length, 1);
  assert.equal((await readdir(path.join(dataDir, 'documents'))).length, 1);

  // Never expose source, credentials, database or arbitrarily selected root files.
  for (const route of ['/.env', '/server/app.js', '/package.json', '/.git/config', '/data/lex-studium.sqlite', '/docs/backend.md']) {
    assert.equal((await fetch(running.base + route)).status, 404, route);
  }
  assert.equal((await fetch(running.base + '/')).status, 200);
  assert.equal((await fetch(running.base + '/documents.js')).status, 200);

  await running.close();
  running = await startApp(dataDir, hash);
  assert.equal((await (await fetch(running.base + '/api/documents')).json()).documents.length, 1);
  assert.deepEqual(Buffer.from(await (await fetch(running.base + document.downloadUrl)).arrayBuffer()), pdf);
  const persisted = await (await fetch(running.base + '/api/admin/session', { headers: { Cookie: credentials.cookie } })).json();
  assert.equal(persisted.authenticated, true);
  assert.equal((await fetch(running.base + '/api/admin/logout', { method: 'POST', headers: { Origin: origin, Cookie: credentials.cookie, 'X-CSRF-Token': credentials.body.csrfToken } })).status, 200);
  assert.equal((await upload(running.base, credentials, 'prueba.pdf', pdf)).status, 401);
});

test('la contraseña se limita por IP y Secure está activo en producción', async t => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'lex-ratelimit-test-'));
  const running = await startApp(dataDir, await hashPassword(password), true);
  t.after(async () => { await running.close(); await rm(dataDir, { recursive: true, force: true }); });
  const valid = await login(running.base, password, 'https://lex.example');
  assert.match(valid.response.headers.get('set-cookie'), /; Secure/);
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => login(running.base, 'incorrecta', 'https://lex.example')));
  assert.equal(concurrent.filter(x => x.response.status === 401).length, 5);
  assert.equal(concurrent.filter(x => x.response.status === 429).length, 5);
  const limited = await login(running.base, password, 'https://lex.example');
  assert.equal(limited.response.status, 429);
  assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
});

test('sin configuración no se activa una administración ficticia', async t => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'lex-unconfigured-test-'));
  const running = await startApp(dataDir, '');
  t.after(async () => { await running.close(); await rm(dataDir, { recursive: true, force: true }); });
  assert.deepEqual(await (await fetch(running.base + '/api/admin/session')).json(), { configured: false, authenticated: false });
  assert.equal((await login(running.base)).response.status, 503);
});

test('cambiar o eliminar la contraseña revoca las sesiones persistentes', async t => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'lex-revoke-test-'));
  let running = await startApp(dataDir, await hashPassword(password));
  t.after(async () => { await running.close(); await rm(dataDir, { recursive: true, force: true }); });
  const credentials = await login(running.base);
  await running.close();
  running = await startApp(dataDir, await hashPassword('otra contraseña suficientemente larga'));
  assert.equal((await (await fetch(running.base + '/api/admin/session', { headers: { Cookie: credentials.cookie } })).json()).authenticated, false);
  await running.close();
  running = await startApp(dataDir, '');
  assert.equal((await upload(running.base, credentials, 'prueba.pdf', pdf)).status, 401);
});
