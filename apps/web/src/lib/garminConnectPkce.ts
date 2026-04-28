/**
 * PKCE for Garmin Connect Developer Program OAuth (browser step 1).
 * Verifier: 43-128 chars from [A-Za-z0-9-._~]
 */

const PKCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

export function garminPkceVerifierStorageKey(authUserId: string): string {
  return `kinetix_garmin_pkce_verifier:${authUserId}`
}

function randomGarminCodeVerifier(length: number): string {
  const buf = new Uint8Array(length)
  crypto.getRandomValues(buf)
  let s = ''
  for (let i = 0; i < length; i++) {
    s += PKCE_CHARS[buf[i]! % PKCE_CHARS.length]
  }
  return s
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createGarminPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomGarminCodeVerifier(64)
  const challenge = await sha256Base64Url(verifier)
  return { verifier, challenge }
}
