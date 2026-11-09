import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('Usa una contraseña de entre 12 y 256 caracteres.');
  }
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export function validPasswordHash(hash) {
  return /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash || '');
}
export async function verifyPassword(password, hash) {
  if (!validPasswordHash(hash) || typeof password !== 'string' || password.length > 256) return false;
  const [, salt, expected] = hash.split('$');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
