import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ThemeProvider from './context/ThemeProvider';
import Layout from './components/layout/Layout';
import OwnerRoute from './components/common/OwnerRoute';
import { Box, CircularProgress } from '@mui/material';

const Landing = lazy(() => import('./pages/Landing'));
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tutorials = lazy(() => import('./pages/Tutorials'));
const TutorialDetail = lazy(() => import('./pages/TutorialDetail'));
const Notes = lazy(() => import('./pages/Notes'));
const LicenseReport = lazy(() => import('./pages/LicenseReport'));
const ProgressTracker = lazy(() => import('./pages/ProgressTracker'));

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <CircularProgress size={32} />
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/ArchNorth">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<Layout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tutorials" element={<Tutorials />} />
              <Route path="/tutorials/:id" element={<TutorialDetail />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/progress" element={<OwnerRoute><ProgressTracker /></OwnerRoute>} />
              <Route path="/license" element={<LicenseReport />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
