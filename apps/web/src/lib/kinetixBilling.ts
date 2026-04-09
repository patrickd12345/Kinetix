export type KinetixCheckoutErrorCode =
  | 'unauthorized'
  | 'billing_unavailable'
  | 'checkout_failed'
  | 'network_error'

export type KinetixCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; code: KinetixCheckoutErrorCode; message: string }

export async function createKinetixCheckoutSession(args: {
  accessToken: string | null | undefined
  successUrl: string
  cancelUrl: string
  entitlementKey?: string
}): Promise<KinetixCheckoutResult> {
  const accessToken = typeof args.accessToken === 'string' ? args.accessToken.trim() : ''
  if (!accessToken) {
    return { ok: false, code: 'unauthorized', message: 'You must be signed in to continue to checkout.' }
  }

  try {
    const res = await fetch('/api/billing/create-checkout-session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        successUrl: args.successUrl,
        cancelUrl: args.cancelUrl,
        entitlementKey: args.entitlementKey,
      }),
    })

    if (res.status === 503) {
      return {
        ok: false,
        code: 'billing_unavailable',
        message: 'Billing is temporarily unavailable. Please try again in a few minutes.',
      }
    }

    if (res.status === 401) {
      return {
        ok: false,
        code: 'unauthorized',
        message: 'Your session expired. Please sign in again and retry.',
      }
    }

    const data = (await res.json().catch(() => ({}))) as { url?: unknown }
    if (!res.ok) {
      return {
        ok: false,
        code: 'checkout_failed',
        message: 'Checkout could not be started. Please try again.',
      }
    }

    const url = typeof data.url === 'string' ? data.url.trim() : ''
    if (!url) {
      return {
        ok: false,
        code: 'checkout_failed',
        message: 'Checkout could not be started. Please try again.',
      }
    }

    return { ok: true, url }
  } catch {
    return {
      ok: false,
      code: 'network_error',
      message: 'Network error starting checkout. Please retry.',
    }
  }
}

