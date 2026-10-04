import { useSyncExternalStore } from 'react';
import { Box } from '@mui/material';
import { loadingTracker } from '../../lib/lazyWithPreload';

/** Thin bar across the top of the screen while a page or tutorial is loading. */
export default function RouteProgressBar() {
  const loading = useSyncExternalStore(loadingTracker.subscribe, loadingTracker.isLoading);
  if (!loading) return null;

  return (
    <Box
      role="progressbar"
      aria-label="Loading"
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3, overflow: 'hidden',
        zIndex: (theme) => theme.zIndex.tooltip + 1, pointerEvents: 'none',
        animation: 'rpb-appear 0.15s ease 0.1s both',
        '@keyframes rpb-appear': { from: { opacity: 0 }, to: { opacity: 1 } },
        '&::before': {
          content: '""', position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%',
          borderRadius: 2, bgcolor: 'primary.main',
          boxShadow: (theme) => `0 0 8px ${theme.palette.primary.main}`,
          animation: 'rpb-slide 1.1s ease-in-out infinite',
        },
        '@keyframes rpb-slide': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(250%)' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&::before': { animation: 'none', width: '100%', opacity: 0.7 },
        },
      }}
    />
  );
}
