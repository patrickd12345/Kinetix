import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './components/providers/AuthProvider'
import AppErrorBoundary from './components/AppErrorBoundary'
import { hydrateThemeClassFromStorage } from './store/themeStore'

hydrateThemeClassFromStorage()
void import('./lib/sentry')
  .then(({ initWebSentry }) => initWebSentry())
  .catch((error) => {
    console.warn('[sentry] Failed to load web Sentry', error)
  })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
