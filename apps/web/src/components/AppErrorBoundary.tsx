import { Component, ErrorInfo, ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  message: string
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred while loading Kinetix.',
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AppErrorBoundary] Unhandled error during app render', error, errorInfo)
  }

  private reloadPage = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center px-4">
          <div className="w-full max-w-md glass rounded-2xl border border-red-500/30 p-6 space-y-3">
            <h1 className="text-xl font-bold text-red-400">App failed to load</h1>
            <p className="text-sm text-gray-300">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.reloadPage}
              className="mt-2 rounded-lg bg-red-500/20 border border-red-500/40 px-4 py-2 text-sm text-red-200 hover:bg-red-500/30 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
