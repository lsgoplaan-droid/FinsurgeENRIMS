import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center min-h-[300px] p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md">
            <AlertTriangle className="text-red-500 mx-auto mb-3" size={28} />
            <h3 className="text-sm font-bold text-red-800 mb-1">Something went wrong</h3>
            <p className="text-xs text-red-600 mb-3">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
            >
              <RefreshCw size={12} />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
