import { randomBytes, createHash } from 'crypto';

/**
 * Gera um token opaco e aleatório (o que é enviado pro usuário, no link do e-mail).
 */
export function generateRawToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Gera o hash SHA-256 do token (o que é salvo no banco).
 * Nunca salvamos o token "cru" — se o banco vazar, os tokens continuam inúteis.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
