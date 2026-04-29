import { useEffect, useState } from 'react'

/**
 * AdSense placeholder slot — no third-party script push here (KX-MVP-BETA-001).
 * Renders a stable SSR-safe shell first, then mounts placeholder content after hydration.
 */
export default function AdSlot() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className="min-h-[90px] w-full rounded-lg border border-dashed border-slate-300/50 bg-slate-100/40 dark:border-white/10 dark:bg-white/[0.03]"
        aria-hidden
      />
    )
  }

  return (
    <aside
      className="flex min-h-[90px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300/70 p-4 text-center dark:border-white/15"
      aria-label="Advertisement placeholder"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ad slot</span>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">Publisher slot reserved — no script loaded in this build.</p>
    </aside>
  )
}
