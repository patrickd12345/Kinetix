/**
 * Minimal ops-only auth for support ticket mutations (not end-user auth).
 * Requires env KINETIX_SUPPORT_OPS_SECRET and matching header or Bearer token.
 */

/**
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {string | undefined} expectedSecret from runtime (trimmed)
 * @returns {{ ok: true } | { ok: false, code: 'unconfigured' | 'unauthorized' }}
 */
import crypto from 'node:crypto';

export function verifySupportOpsSecret(headers, expectedSecret) {
  if (!expectedSecret || !String(expectedSecret).trim()) {
    return { ok: false, code: 'unconfigured' };
  }
  const exp = String(expectedSecret).trim();
  const rawHeader = headers['x-kinetix-support-ops-secret'];
  const fromHeader = typeof rawHeader === 'string' ? rawHeader.trim() : '';
  const auth = headers.authorization;
  let fromBearer = '';
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    fromBearer = auth.slice(7).trim();
  }
  const got = fromHeader || fromBearer;
  if (!got) {
    return { ok: false, code: 'unauthorized' };
  }

  const expHash = crypto.createHash('sha256').update(exp).digest();
  const gotHash = crypto.createHash('sha256').update(got).digest();
  if (!crypto.timingSafeEqual(expHash, gotHash)) {
    return { ok: false, code: 'unauthorized' };
  }

  return { ok: true };
}
