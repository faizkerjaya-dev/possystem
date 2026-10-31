import { Component, type ErrorInfo, type ReactNode } from 'react';
import { log } from '@/lib/logger';

/** Catches crashes in a screen and shows the error instead of a white page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.error('crash', error.message, { stack: error.stack, component: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-4 bg-cream p-6 text-center">
        <span className="text-xl font-extrabold">This screen crashed</span>
        <code className="max-w-xl rounded-lg bg-white p-3 text-left text-sm text-danger">{this.state.error.message}</code>
        <span className="max-w-md text-sm text-muted">
          Take a photo of this message for whoever maintains the system. Details are in the browser console under [POS][crash].
        </span>
        <button type="button" className="h-12 rounded-xl bg-ink px-6 font-bold text-white" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
