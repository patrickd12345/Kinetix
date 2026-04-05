import ThemeSelector from '../components/ThemeSelector'

export default function EntitlementRequired() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 flex items-center justify-center px-4 dark:from-gray-950 dark:via-black dark:to-gray-950">
      <div className="absolute right-4 top-4 z-10">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md glass rounded-2xl border border-slate-200/90 p-6 space-y-3 dark:border-white/10">
        <h1 className="text-2xl font-black italic tracking-wider text-slate-900 dark:text-white">KINETIX</h1>
        <h2 className="text-lg font-semibold text-cyan-800 dark:text-cyan-300">Entitlement required</h2>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          The current account is signed in, but no active `kinetix` entitlement exists in platform access.
        </p>
      </div>
    </div>
  )
}
