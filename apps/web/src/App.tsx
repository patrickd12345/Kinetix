import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdSenseScript from './components/ads/AdSenseScript'
import Layout from './components/Layout'
import RunDashboard from './pages/RunDashboard'
import History from './pages/History'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import WeightHistory from './pages/WeightHistory'
import Menu from './pages/Menu'
import HelpCenter from './pages/HelpCenter'
import Login from './pages/Login'
import EntitlementRequired from './pages/EntitlementRequired'
import { useAuth } from './components/providers/useAuth'

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
  const { status, error, profile } = useAuth()

  if (status === 'loading') {
    return <FullscreenStatus title="Loading identity..." message="Checking your account and platform access." />
  }

  if (status === 'error') {
    return (
      <FullscreenStatus
        title="Profile validation failed"
        message={error ?? 'Platform profile is required for Kinetix.'}
        tone="error"
      />
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
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
    <Layout>
      <Routes>
        <Route path="/" element={<RunDashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/weight-history" element={<WeightHistory />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdSenseScript />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
