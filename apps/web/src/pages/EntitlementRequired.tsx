export default function EntitlementRequired() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl border border-white/10 p-6 space-y-3">
        <h1 className="text-2xl font-black italic tracking-wider text-white">KINETIX</h1>
        <h2 className="text-lg font-semibold text-cyan-300">Entitlement required</h2>
        <p className="text-sm text-gray-300">
          The current account is signed in, but no active `kinetix` entitlement exists in platform access.
        </p>
      </div>
    </div>
  )
}
