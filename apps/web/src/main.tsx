import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './components/providers/AuthProvider'
import AppErrorBoundary from './components/AppErrorBoundary'
import { hydrateThemeClassFromStorage } from './store/themeStore'
import { initWebSentry, Sentry } from './lib/sentry'

hydrateThemeClassFromStorage()
initWebSentry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="p-4 text-sm">Something went wrong.</div>}>
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
