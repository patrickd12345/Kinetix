import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RunDashboard from './pages/RunDashboard'
import History from './pages/History'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
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
      ? 'border-red-500/30'
      : 'border-white/10'

  const titleClasses =
    tone === 'error'
      ? 'text-red-400'
      : 'text-white'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center px-4">
      <div className={`w-full max-w-md glass rounded-2xl ${toneClasses} p-6 space-y-2`}>
        <h1 className={`text-xl font-bold ${titleClasses}`}>{title}</h1>
        <p className="text-sm text-gray-300">{message}</p>
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
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
