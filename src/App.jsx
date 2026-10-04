import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import ThemeProvider from './context/ThemeProvider';
import Layout from './components/layout/Layout';
import AppLoader from './components/common/AppLoader';
import ErrorBoundary from './components/common/ErrorBoundary';
import RouteProgressBar from './components/common/RouteProgressBar';
import NotFound from './pages/NotFound';
import {
  Landing, Home, Dashboard, Tutorials, TutorialDetail, Notes, LicenseReport, PrivateProgress, Feedback,
} from './routes/pages';

function AppRoutes() {
  const { pathname } = useLocation();
  return (
    // Last line of defense: an error outside the Layout shows a message instead of a blank screen.
    <ErrorBoundary fullscreen resetKey={pathname}>
      {/* Pages inside Layout have their own boundaries (in Layout), so the header and sidebar stay visible. */}
      <Suspense fallback={<AppLoader variant="fullscreen" label="Loading ArchNorth…" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tutorials" element={<Tutorials />} />
            <Route path="/tutorials/:id" element={<TutorialDetail />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/progress" element={<PrivateProgress />} />
            <Route path="/license" element={<LicenseReport />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/ArchNorth">
        <RouteProgressBar />
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}
