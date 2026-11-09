import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const rootDir = fileURLToPath(new URL('../', import.meta.url));
const app = await createApp({
  rootDir, dataDir: process.env.DATA_DIR,
  publicOrigin: process.env.PUBLIC_ORIGIN || `http://localhost:${port}`,
  passwordHash: process.env.ADMIN_PASSWORD_HASH,
  production: process.env.NODE_ENV === 'production',
});
const server = http.createServer({ requestTimeout: 60000, headersTimeout: 15000, maxHeaderSize: 16384 }, app.handler);
server.listen(port, host, () => {
  console.log(`Lex Studium disponible en ${process.env.PUBLIC_ORIGIN || `http://localhost:${port}`}`);
  if (!process.env.ADMIN_PASSWORD_HASH) console.log('Administración desactivada: configura ADMIN_PASSWORD_HASH para habilitar cargas.');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => { app.close(); process.exit(0); });
  server.closeIdleConnections();
});
