import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-red-600 mb-4">The page failed to load properly.</p>
            <details className="text-sm text-gray-600">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error?.message}
                {'\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}