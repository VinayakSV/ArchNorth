import { useState, useRef, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';
import ScrollToTop from '../common/ScrollToTop';
import AppLoader from '../common/AppLoader';
import ErrorBoundary from '../common/ErrorBoundary';
import { whenIdle } from '../../lib/lazyWithPreload';
import { preloadLikelyPages } from '../../routes/pages';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);
  const { pathname } = useLocation();

  // A new page (sidebar click or an in-content link like "Next chapter") starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Once the app shell is up, fetch the pages people usually open next while the browser is idle.
  useEffect(() => whenIdle(preloadLikelyPages), []);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: 0,
          overflow: 'hidden',
        }}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {/* Non-scrolling wrapper — holds progress bar + FAB */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <ScrollToTop scrollRef={scrollRef} />
          {/* Scrollable content */}
          <Box
            ref={scrollRef}
            sx={{
              height: '100%',
              overflow: 'auto',
              p: { xs: 1.5, sm: 2, md: 4 },
              maxWidth: 1200,
              width: '100%',
              mx: 'auto',
            }}
          >
            {/* A failing page shows a message here; header and sidebar keep working. */}
            <ErrorBoundary resetKey={pathname}>
              <Suspense fallback={<AppLoader variant="page" label="Loading page…" />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
