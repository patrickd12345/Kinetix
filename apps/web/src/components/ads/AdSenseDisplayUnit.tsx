import { useEffect, useRef } from 'react'
import { getPublicAdsenseClient, getPublicAdsenseSlot, shouldShowDisplayAd } from '@/lib/adsense'

const PUSH_POLL_MS = 50
const PUSH_MAX_ATTEMPTS = 200
const PUSHED_ATTR = 'data-kinetix-adsense-pushed'

function tryPushAdsbygoogle(): boolean {
  const w = window as Window & { adsbygoogle?: unknown[] }
  if (!w.adsbygoogle) return false
  try {
    w.adsbygoogle.push({})
    return true
  } catch {
    return false
  }
}

export default function AdSenseDisplayUnit() {
  const insRef = useRef<HTMLModElement>(null)

  useEffect(() => {
    if (!shouldShowDisplayAd()) return
    const el = insRef.current
    if (!el?.isConnected || el.getAttribute(PUSHED_ATTR)) return

    let attempts = 0
    const t = window.setInterval(() => {
      attempts++
      if (tryPushAdsbygoogle()) {
        el.setAttribute(PUSHED_ATTR, '1')
        window.clearInterval(t)
      } else if (attempts >= PUSH_MAX_ATTEMPTS) {
        window.clearInterval(t)
      }
    }, PUSH_POLL_MS)

    return () => window.clearInterval(t)
  }, [])

  if (!shouldShowDisplayAd()) return null

  const client = getPublicAdsenseClient()
  const slot = getPublicAdsenseSlot()
  if (!client || !slot) return null

  return (
    <section
      className="mt-8 rounded-lg border border-dashed border-slate-300/80 p-3 dark:border-white/15"
      aria-label="Advertisement"
    >
      <p className="mb-2 text-center text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Ad
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle block min-h-[90px] w-full max-w-full"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </section>
  )
}
