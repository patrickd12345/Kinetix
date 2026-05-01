import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AdSenseScript from './components/ads/AdSenseScript'
import Layout from './components/Layout'
import RunDashboard from './pages/RunDashboard'
import Login from './pages/Login'
import EntitlementRequired from './pages/EntitlementRequired'
import { useAuth } from './components/providers/useAuth'

// Lazy: keep Garmin OAuth + PKCE crypto (Settings) and other heavy routes out of index-*.js.
// See scripts/check-web-bundle-budget.mjs (900 kB cap on main chunk).
const Settings = lazy(() => import('./pages/Settings'))
const History = lazy(() => import('./pages/History'))
const Chat = lazy(() => import('./pages/Chat'))
const WeightHistory = lazy(() => import('./pages/WeightHistory'))
const HelpCenter = lazy(() => import('./pages/HelpCenter'))
const BillingSuccess = lazy(() => import('./pages/BillingSuccess'))
const BillingCancel = lazy(() => import('./pages/BillingCancel'))
const Coaching = lazy(() => import('./pages/Coaching'))
const Menu = lazy(() => import('./pages/Menu'))
const OperatorDashboard = lazy(() => import('./pages/OperatorDashboard'))
const SupportQueue = lazy(() => import('./pages/SupportQueue'))

function LazyRouteFallback() {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/80 px-4 py-8 text-center text-sm text-[var(--shell-text-secondary)] dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--shell-text-secondary)]">
      Loading&hellip;
    </div>
  )
}

function FullscreenStatus({
  title,
  message,
  tone = 'neutral',
}: {
  title: string
  message: string
  tone?: 'neutral' | 'error'
}) {
  const toneClasses =
    tone === 'error'
      ? 'border-red-500/40 dark:border-red-500/30'
      : 'border-slate-200/90 dark:border-white/10'

  const titleClasses =
    tone === 'error'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-900 dark:text-white'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 flex items-center justify-center px-4 dark:from-gray-950 dark:via-black dark:to-gray-950">
      <div className={`w-full max-w-md glass rounded-2xl ${toneClasses} p-6 space-y-2`}>
        <h1 className={`text-xl font-bold ${titleClasses}`}>{title}</h1>
        <p className="text-sm text-slate-600 dark:text-gray-300">{message}</p>
      </div>
    </div>
  )
}

function ProtectedRoutes() {
  const { status, error, profile, session } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullscreenStatus title="Loading identity..." message="Checking your account and platform access." />
  }

  if (status === 'error') {
    const err = error ?? ''
    const title =
      err.includes('Missing Supabase env') || err.includes('VITE_SUPABASE')
        ? 'Supabase not configured'
        : err.includes('Platform profile not found')
          ? 'Platform profile missing'
          : 'Profile validation failed'
    return (
      <FullscreenStatus
        title={title}
        message={error ?? 'Platform profile is required for Kinetix.'}
        tone="error"
      />
    )
  }

  if (status === 'unauthenticated') {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (status === 'forbidden') {
    return <EntitlementRequired />
  }

  // Keep routing resilient: if profile hydration lags behind auth status,
  // avoid mounting pages that depend on profile data.
  if (!profile) {
    return (
      <FullscreenStatus
        title="Loading profile..."
        message="Finalizing your platform profile. If this does not resolve, refresh the page."
      />
    )
  }

  return (
    <Layout key={session?.user?.id ?? 'shell'}>
      <Suspense fallback={<LazyRouteFallback />}>
        <Routes>
          <Route path="/" element={<RunDashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/coaching" element={<Coaching />} />
          <Route path="/weight-history" element={<WeightHistory />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/operator" element={<OperatorDashboard />} />
          <Route path="/support-queue" element={<SupportQueue />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdSenseScript />
      <Suspense fallback={<LazyRouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/billing/cancel" element={<BillingCancel />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
