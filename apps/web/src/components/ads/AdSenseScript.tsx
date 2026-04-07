import { useEffect } from 'react'
import { getAdsenseLoaderUrl, getPublicAdsenseClient, shouldLoadAdSense } from '@/lib/adsense'

const SCRIPT_ATTR = 'data-kinetix-adsense-loader'

let moduleInjected = false

export default function AdSenseScript() {
  useEffect(() => {
    if (!shouldLoadAdSense()) return
    if (typeof document === 'undefined') return
    if (moduleInjected) return
    if (document.querySelector(`script[${SCRIPT_ATTR}]`)) {
      moduleInjected = true
      return
    }

    const client = getPublicAdsenseClient()
    if (!client) return

    const src = getAdsenseLoaderUrl(client)
    const el = document.createElement('script')
    el.async = true
    el.crossOrigin = 'anonymous'
    el.src = src
    el.setAttribute(SCRIPT_ATTR, '1')
    document.head.appendChild(el)
    moduleInjected = true
  }, [])

  return null
}
