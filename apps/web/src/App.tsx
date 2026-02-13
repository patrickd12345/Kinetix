import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RunDashboard from './pages/RunDashboard'
import History from './pages/History'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import Login from './pages/Login'
import EntitlementRequired from './pages/EntitlementRequired'
import { useAuth } from './components/providers/useAuth'

function ProtectedRoutes() {
  const { status, error } = useAuth()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center">
        <div className="glass rounded-xl border border-white/10 px-5 py-3 text-sm text-gray-300">
          Loading identity...
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md glass rounded-2xl border border-red-500/30 p-6 space-y-2">
          <h1 className="text-xl font-bold text-red-400">Profile validation failed</h1>
          <p className="text-sm text-gray-300">{error ?? 'Platform profile is required for Kinetix.'}</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (status === 'forbidden') {
    return <EntitlementRequired />
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
