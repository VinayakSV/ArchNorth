import { lazyWithPreload } from '../lib/lazyWithPreload';

// Every page is code-split; `preload()` lets the app fetch a page before the visitor clicks.
export const Landing = lazyWithPreload(() => import('../pages/Landing'));
export const Home = lazyWithPreload(() => import('../pages/Home'));
export const Dashboard = lazyWithPreload(() => import('../pages/Dashboard'));
export const Tutorials = lazyWithPreload(() => import('../pages/Tutorials'));
export const TutorialDetail = lazyWithPreload(() => import('../pages/TutorialDetail'));
export const Notes = lazyWithPreload(() => import('../pages/Notes'));
export const LicenseReport = lazyWithPreload(() => import('../pages/LicenseReport'));
export const PrivateProgress = lazyWithPreload(() => import('../pages/PrivateProgress'));
export const Feedback = lazyWithPreload(() => import('../pages/Feedback'));

/** The pages a visitor most often opens next once inside the app. */
export function preloadLikelyPages() {
  Home.preload();
  Dashboard.preload();
  Tutorials.preload();
  TutorialDetail.preload();
}
