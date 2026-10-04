import { Component } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ErrorOutline, Refresh, Home } from '@mui/icons-material';
import AppLoader from './AppLoader';
import { isChunkLoadError, reloadForNewVersion } from '../../lib/staleVersion';

/**
 * Catches render errors so a failure never leaves a blank screen.
 * - A code file that can't load (usually a new deployment) → reload once to the latest version.
 * - Anything else → a friendly message with Reload / Home buttons.
 * `resetKey` (the current path) clears the error when the visitor navigates elsewhere.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, reloading: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && reloadForNewVersion()) {
      this.setState({ reloading: true });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, reloading: false });
    }
  }

  render() {
    const { error, reloading } = this.state;
    const { children, fullscreen } = this.props;
    if (!error) return children;

    if (reloading) {
      return <AppLoader variant={fullscreen ? 'fullscreen' : 'page'} label="Updating to the latest version…" />;
    }

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const chunk = isChunkLoadError(error);
    const title = chunk ? 'This page couldn’t load' : 'Something went wrong';
    const detail = offline
      ? 'You seem to be offline. Reconnect and reload to continue.'
      : chunk
        ? 'ArchNorth may have just been updated. Reloading gets you the latest version.'
        : 'An unexpected error stopped this page from showing. Reloading usually fixes it.';

    return (
      <Box
        role="alert"
        sx={{
          minHeight: fullscreen ? '100vh' : '45vh', bgcolor: fullscreen ? 'background.default' : 'transparent',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1.5, px: 3, textAlign: 'center',
        }}
      >
        <ErrorOutline sx={{ fontSize: 44, color: 'warning.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>{detail}</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="contained" startIcon={<Refresh />} onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button variant="outlined" startIcon={<Home />} href={`${import.meta.env.BASE_URL}home`}>
            Go to Home
          </Button>
        </Box>
      </Box>
    );
  }
}
