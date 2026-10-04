import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts ship with the site, so visitors' browsers never contact Google Fonts.
import '@fontsource-variable/inter';
import '@fontsource-variable/fira-code';
import './styles/global.scss';
import App from './App';
import { reloadForNewVersion } from './lib/staleVersion';

// Vite fires this when a code-split file's dependencies can't be preloaded — typically an open tab
// still pointing at files from before the latest deployment. Reload once to get the new version.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

// Migrate localStorage keys from old "tech-tutorial" naming to "archnorth"
const migrations = [
  ['tech-tutorial-notes', 'archnorth-notes'],
  ['tech-tutorial-notes-by-tutorial', 'archnorth-notes-by-tutorial'],
];
migrations.forEach(([oldKey, newKey]) => {
  const old = localStorage.getItem(oldKey);
  if (old && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, old);
    localStorage.removeItem(oldKey);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
