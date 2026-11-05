import { Component } from 'react';
import StatusPage from '../../pages/errors/StatusPage';

const RELOAD_KEY = 'chunk-reload-at';

// After a new deployment, old lazily-loaded chunks no longer exist on the server
const isChunkError = (error) =>
  /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error?.message || ''
  );

/**
 * Catches render errors so one broken screen never takes the whole app down.
 * A stale-deployment chunk error triggers a single automatic reload.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('❌ [UI ERROR]', error, info?.componentStack);
    if (isChunkError(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 30000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* ignore */
      }
    }
  }

  componentDidUpdate(prevProps) {
    // Reset when navigating to another page
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback || <StatusPage variant={500} showReload compact={this.props.compact} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
