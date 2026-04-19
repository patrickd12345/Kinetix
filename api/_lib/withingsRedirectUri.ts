/**
 * Withings OAuth: redirect_uri in the token request must match authorize + partner callback URL exactly.
 * @see https://developer.withings.com/
 */

/** sessionStorage key: persisted redirect_uri from authorize step so token exchange cannot drift from it. */
export const KINETIX_WITHINGS_REDIRECT_STORAGE_KEY = 'kinetix_withings_redirect_uri'
export const KINETIX_WITHINGS_CALLBACK_PATH = '/api/withings-oauth'

export function normalizeWithingsRedirectUri(uri: string): string {
  const t = typeof uri === 'string' ? uri.trim() : ''
  if (!t) {
    return ''
  }
  return t.replace(/\/+$/, '')
}

/** Browser / authorize: prefer VITE_WITHINGS_REDIRECT_URI when set (avoids www vs apex mismatches). */
export function resolveWithingsRedirectUriForOAuth(params: {
  explicit?: string | undefined
  origin?: string | undefined
}): string {
  const ex = params.explicit?.trim()
  if (ex) {
    return normalizeWithingsRedirectUri(ex)
  }
  const o = params.origin?.trim()
  if (o) {
    return normalizeWithingsRedirectUri(`${o.replace(/\/+$/, '')}${KINETIX_WITHINGS_CALLBACK_PATH}`)
  }
  return ''
}

/** Server token exchange: body wins (must match authorize), then env, then Origin + callback endpoint. */
export function resolveWithingsRedirectUriForTokenExchange(params: {
  bodyRedirectUri?: string | undefined
  envRedirectUri?: string | undefined
  requestOrigin?: string | undefined
}): string {
  const b = params.bodyRedirectUri?.trim()
  if (b) {
    return normalizeWithingsRedirectUri(b)
  }
  const e = params.envRedirectUri?.trim()
  if (e) {
    return normalizeWithingsRedirectUri(e)
  }
  const o = params.requestOrigin?.trim()
  if (o) {
    return normalizeWithingsRedirectUri(`${o.replace(/\/+$/, '')}${KINETIX_WITHINGS_CALLBACK_PATH}`)
  }
  return ''
}
