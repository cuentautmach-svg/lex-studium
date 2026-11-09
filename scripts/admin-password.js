import { hashPassword } from '../server/password.js';

// No contraseña en argumentos, historial ni archivos. Se puede usar también stdin.
if (process.stdin.isTTY) {
  process.stderr.write('Nueva contraseña de administrador (mínimo 12 caracteres; entrada oculta): ');
  process.stdin.setRawMode(true);
}
let password = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async chunk => {
  for (const char of chunk) {
    if (char === '\u0003') process.exit(130);
    if (char === '\r' || char === '\n') {
      process.stdin.pause();
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      try {
        const hash = await hashPassword(password);
        process.stderr.write('\nGuarda esta línea en .env (archivo privado):\n');
        process.stdout.write(`ADMIN_PASSWORD_HASH='${hash}'\n`);
        process.exit(0);
      } catch (error) { process.stderr.write(`\n${error.message}\n`); process.exit(1); }
    }
    if (char === '\u007f' || char === '\b') password = password.slice(0, -1);
    else if (password.length < 257) password += char;
  }
});
process.stdin.on('end', async () => {
  try { process.stdout.write(`ADMIN_PASSWORD_HASH='${await hashPassword(password)}'\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
});
