import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'kinetix_cookie_consent_v1'

function readAccepted(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) === 'accepted'
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (readAccepted()) return
    setVisible(true)
  }, [])

  const accept = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted')
    } catch {
      /* ignore quota / private mode */
    }
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed bottom-14 left-0 right-0 z-[45] border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/95 md:bottom-4 md:left-auto md:right-4 md:max-w-md md:rounded-xl md:border"
      role="dialog"
      aria-label="Cookie notice"
    >
      <p className="text-xs text-slate-700 dark:text-slate-300">
        We use cookies and local storage for sign-in, preferences, and (where enabled) ads. By continuing you accept our{' '}
        <Link className="text-cyan-800 underline dark:text-cyan-400" to="/privacy">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={accept}
          className="shell-focus-ring rounded-lg bg-cyan-700 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-500"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
