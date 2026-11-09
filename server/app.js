import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, chmod, readFile, realpath, stat, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import Busboy from 'busboy';
import { validPasswordHash, verifyPassword } from './password.js';
import { MAX_FILE_BYTES, validateDocument } from './validate-document.js';

const COOKIE_NAME = 'lex_admin_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const publicFiles = new Set(['index.html', 'experience.css', 'documents.css', 'documents.js', 'design-polish.css', 'studio-redesign.css']);
const mime = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const hash = value => createHash('sha256').update(value).digest('hex');
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
function equalText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function getToken(request) {
  const cookie = request.headers.cookie || '';
  const token = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}
function cookie(value, production, clear = false) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_MS / 1000}${production ? '; Secure' : ''}`;
}
function disposition(filename, mode) {
  const fallback = filename.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(filename).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${utf8}`;
}
async function jsonBody(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw httpError(415, 'Envía una solicitud JSON.');
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw httpError(413, 'Solicitud demasiado grande.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw httpError(400, 'La solicitud JSON no es válida.'); }
}
function multipartBody(request) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({ headers: request.headers, defParamCharset: 'utf8', limits: { fileSize: MAX_FILE_BYTES + 1, files: 1, fields: 2, fieldSize: 6000, parts: 4, headerPairs: 100 } });
    } catch { reject(httpError(400, 'Selecciona un documento para subir.')); return; }
    let failure; let file; const fields = {};
    const fail = error => { failure ||= error; };
    parser.on('field', (name, value, info) => {
      if (!['title', 'description'].includes(name) || Object.hasOwn(fields, name) || info.valueTruncated) fail(httpError(400, 'Los datos del documento no son válidos.'));
      fields[name] = value;
    });
    parser.on('file', (name, stream, info) => {
      const chunks = []; let size = 0;
      if (name !== 'file' || file) fail(httpError(400, 'Selecciona un solo documento.'));
      const filename = typeof info.filename === 'string' ? info.filename.normalize('NFC') : '';
      if (!filename || filename.length > 200 || /[\x00-\x1f\x7f/\\]/.test(filename)) fail(httpError(400, 'El nombre del archivo no es válido.'));
      file = { filename };
      stream.on('limit', () => fail(httpError(413, 'El archivo supera el máximo de 20 MB.')));
      stream.on('data', chunk => { size += chunk.length; if (!failure) chunks.push(chunk); });
      stream.on('error', () => fail(httpError(400, 'No se pudo leer el documento.')));
      stream.on('end', () => { file.buffer = Buffer.concat(chunks); file.size = size; });
    });
    parser.on('filesLimit', () => fail(httpError(400, 'Selecciona un solo documento.')));
    parser.on('fieldsLimit', () => fail(httpError(400, 'Demasiados datos en el formulario.')));
    parser.on('partsLimit', () => fail(httpError(400, 'Demasiados datos en el formulario.')));
    parser.on('error', () => reject(httpError(400, 'La carga del documento está incompleta.')));
    request.on('aborted', () => reject(httpError(400, 'La carga fue interrumpida.')));
    parser.on('close', () => {
      if (failure) return reject(failure);
      const title = fields.title?.trim();
      const description = fields.description?.trim() || '';
      if (!file?.buffer?.length || !title || title.length > 160 || description.length > 1000) return reject(httpError(400, 'Escribe un título de hasta 160 caracteres, una descripción de hasta 1000 caracteres y selecciona un documento.'));
      resolve({ ...file, title, description });
    });
    request.pipe(parser);
  });
}

export async function createApp(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const dataDir = path.resolve(options.dataDir || path.join(rootDir, 'data'));
  const materialsDir = path.join(rootDir, 'materiales');
  if (dataDir === rootDir || dataDir === materialsDir || dataDir.startsWith(`${materialsDir}${path.sep}`)) {
    throw new Error('DATA_DIR debe ser una carpeta privada, fuera de materiales/ y distinta de la raíz pública.');
  }
  const filesDir = path.join(dataDir, 'documents');
  const publicOrigin = new URL(options.publicOrigin || 'http://localhost:3000').origin;
  const production = options.production === true;
  const passwordHash = options.passwordHash || '';
  if (passwordHash && !validPasswordHash(passwordHash)) throw new Error('ADMIN_PASSWORD_HASH no tiene un formato válido.');
  if (production && !publicOrigin.startsWith('https://')) throw new Error('PUBLIC_ORIGIN debe usar HTTPS en producción.');
  await mkdir(filesDir, { recursive: true, mode: 0o700 });
  await chmod(dataDir, 0o700);
  await chmod(filesDir, 0o700);
  const db = new DatabaseSync(path.join(dataDir, 'lex-studium.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      filename TEXT NOT NULL, extension TEXT NOT NULL, size INTEGER NOT NULL,
      storage_name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  await chmod(path.join(dataDir, 'lex-studium.sqlite'), 0o600);
  const fingerprint = hash(passwordHash);
  const previousFingerprint = db.prepare("SELECT value FROM settings WHERE key = 'password_fingerprint'").get()?.value;
  if (previousFingerprint !== fingerprint) {
    db.exec('DELETE FROM sessions');
    db.prepare("INSERT OR REPLACE INTO settings VALUES ('password_fingerprint', ?)").run(fingerprint);
  }
  const attempts = new Map();
  let uploads = 0;
  const session = request => {
    if (!passwordHash) return null;
    const token = getToken(request);
    if (!token) return null;
    return db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').get(hash(token), Date.now()) || null;
  };
  const requireOrigin = request => {
    if (request.headers.origin !== publicOrigin || request.headers['sec-fetch-site'] === 'cross-site') {
      throw httpError(403, 'Solicitud no permitida desde este origen.');
    }
  };
  const requireAdmin = request => {
    const current = session(request);
    if (!current) throw httpError(401, 'Inicia sesión como administrador.');
    if (!equalText(request.headers['x-csrf-token'], current.csrf_token)) throw httpError(403, 'La sesión de seguridad cambió. Vuelve a iniciar sesión.');
    return current;
  };
  const sessionBody = current => ({ configured: !!passwordHash, authenticated: !!current, ...(current ? { csrfToken: current.csrf_token } : {}) });
  const documentBody = row => ({
    id: row.id, title: row.title, description: row.description, filename: row.filename,
    extension: row.extension, size: row.size, createdAt: row.created_at,
    viewUrl: `/api/documents/${row.id}/view`, downloadUrl: `/api/documents/${row.id}/download`,
  });

  async function handle(request, response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if (production) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    request.setTimeout(30000);
    const url = new URL(request.url, publicOrigin);
    const pathname = url.pathname;
    if (!['GET', 'HEAD', 'POST'].includes(request.method)) throw httpError(405, 'Método no permitido.');
    if (pathname.startsWith('/api/')) response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'POST') requireOrigin(request);

    if (pathname === '/api/admin/session' && request.method === 'GET') {
      return json(response, 200, sessionBody(session(request)));
    }
    if (pathname === '/api/admin/login' && request.method === 'POST') {
      if (!passwordHash) throw httpError(503, 'La administración todavía no está configurada.');
      const key = request.socket.remoteAddress || 'unknown';
      const now = Date.now();
      for (const [ip, value] of attempts) if (value.resetAt <= now) attempts.delete(ip);
      const attempt = attempts.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };
      if (attempt.count >= 5 || attempts.size > 10000) {
        response.setHeader('Retry-After', Math.max(1, Math.ceil((attempt.resetAt - now) / 1000)));
        throw httpError(429, 'Demasiados intentos. Espera 15 minutos antes de intentarlo de nuevo.');
      }
      attempt.count++;
      attempts.set(key, attempt);
      const body = await jsonBody(request);
      if (!await verifyPassword(body.password, passwordHash)) throw httpError(401, 'La contraseña no es correcta.');
      attempts.delete(key);
      const previous = getToken(request);
      if (previous) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(previous));
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
      const token = randomBytes(32).toString('hex');
      const csrfToken = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash(token), csrfToken, now + SESSION_MS);
      response.setHeader('Set-Cookie', cookie(token, production));
      return json(response, 200, sessionBody({ csrf_token: csrfToken }));
    }
    if (pathname === '/api/admin/logout' && request.method === 'POST') {
      requireAdmin(request);
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(getToken(request)));
      response.setHeader('Set-Cookie', cookie('', production, true));
      return json(response, 200, sessionBody(null));
    }
    if (pathname === '/api/documents' && request.method === 'GET') {
      const documents = db.prepare('SELECT * FROM documents ORDER BY created_at DESC, id DESC').all().map(documentBody);
      return json(response, 200, { documents });
    }
    if (pathname === '/api/documents' && request.method === 'POST') {
      requireAdmin(request);
      if (Number(request.headers['content-length'] || 0) > MAX_FILE_BYTES + 65536) throw httpError(413, 'El archivo supera el máximo de 20 MB.');
      if (uploads >= 2) throw httpError(429, 'Hay otras cargas en curso. Inténtalo de nuevo en unos segundos.');
      uploads++;
      let destination;
      try {
        const file = await multipartBody(request);
        let extension;
        try { extension = await validateDocument(file.buffer, file.filename); }
        catch (error) { throw httpError(400, error.message); }
        const id = randomUUID();
        const storageName = `${id}.${extension}`;
        destination = path.join(filesDir, storageName);
        await writeFile(destination, file.buffer, { flag: 'wx', mode: 0o600 });
        const createdAt = new Date().toISOString();
        db.prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, file.title, file.description, file.filename, extension, file.size, storageName, createdAt);
        destination = null;
        const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        return json(response, 201, { document: documentBody(row) });
      } finally {
        uploads--;
        if (destination) await unlink(destination).catch(() => {});
      }
    }
    const match = pathname.match(/^\/api\/documents\/([a-f0-9-]{36})\/(view|download)$/);
    if (match && ['GET', 'HEAD'].includes(request.method)) {
      const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(match[1]);
      if (!row) throw httpError(404, 'No encontramos este documento.');
      const storedPath = path.join(filesDir, row.storage_name);
      try { await stat(storedPath); } catch { throw httpError(404, 'El archivo no está disponible.'); }
      response.setHeader('Content-Type', mime[row.extension]);
      response.setHeader('Content-Length', row.size);
      response.setHeader('Content-Disposition', disposition(row.filename, match[2] === 'view' && row.extension === 'pdf' ? 'inline' : 'attachment'));
      response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'none'");
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(storedPath);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      return stream.pipe(response);
    }
    if (pathname.startsWith('/api/')) throw httpError(404, 'No encontramos esta función.');
    if (!['GET', 'HEAD'].includes(request.method)) throw httpError(405, 'Método no permitido.');
    let relative;
    try { relative = decodeURIComponent(pathname).replace(/^\//, '') || 'index.html'; }
    catch { throw httpError(400, 'La dirección no es válida.'); }
    const isMaterial = relative.startsWith('materiales/') && !relative.split('/').some(x => !x || x.startsWith('.'));
    if (!publicFiles.has(relative) && !isMaterial) throw httpError(404, 'Página no encontrada.');
    const requestedPath = path.resolve(rootDir, relative);
    let actualPath;
    try { actualPath = await realpath(requestedPath); }
    catch { throw httpError(404, 'Archivo no encontrado.'); }
    if (actualPath !== requestedPath || !actualPath.startsWith(`${rootDir}${path.sep}`)) throw httpError(404, 'Archivo no encontrado.');
    const info = await stat(actualPath);
    if (!info.isFile()) throw httpError(404, 'Archivo no encontrado.');
    const extension = path.extname(relative).slice(1).toLowerCase();
    response.setHeader('Content-Type', mime[extension] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Content-Length', info.size);
    if (isMaterial) {
      response.setHeader('Content-Disposition', disposition(path.basename(relative), extension === 'pdf' ? 'inline' : 'attachment'));
      response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'none'");
    }
    if (request.method === 'HEAD') return response.end();
    const stream = createReadStream(actualPath);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  }
  return {
    handler(request, response) {
      handle(request, response).catch(error => {
        if (response.headersSent) return response.destroy();
        if (!error.status) console.error('Error del servidor de documentos:', error.code || error.name);
        json(response, error.status || 500, { error: error.status ? error.message : 'No se pudo completar la operación. Inténtalo de nuevo.' });
        request.resume();
      });
    },
    close() { db.close(); },
  };
}
