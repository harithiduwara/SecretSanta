import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your data is safe in local storage. Reload to continue.
          </p>
          <button
            className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
