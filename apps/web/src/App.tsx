import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RunDashboard from './pages/RunDashboard'
import History from './pages/History'
import Chat from './pages/Chat'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<RunDashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
