import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.scss';
import App from './App';

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
