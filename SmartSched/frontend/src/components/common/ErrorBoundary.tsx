import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Unexpected rendering error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
          <div className="surface-card max-w-md w-full rounded-2xl p-6 sm:p-7 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-red-500/12 text-danger flex items-center justify-center">
              <AlertTriangle size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-sm text-muted mt-1.5">
                {this.state.errorMessage || 'An unexpected UI error occurred.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                  window.location.assign('/dashboard');
                }}
              >
                <Home size={15} aria-hidden="true" /> Dashboard
              </Button>
              <Button
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                  window.location.reload();
                }}
              >
                <RefreshCw size={15} aria-hidden="true" /> Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
