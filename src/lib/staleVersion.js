// After a new deployment, an open tab (or the offline cache) may still reference old code files
// that no longer exist on the server. Loading one fails, and without handling the screen goes blank.
// The fix is to reload once to pick up the latest version — but never in a loop, and never offline.

const RELOAD_KEY = 'archnorth-version-reload-at';
const MIN_INTERVAL_MS = 60_000;

/** True for errors thrown when a code-split file (or its dependencies) can't be fetched. */
export function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return error?.name === 'ChunkLoadError'
    || /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk \S+ failed/i.test(message);
}

/** Reloads the page to get the latest version. Returns false (and does nothing) if offline or already tried recently. */
export function reloadForNewVersion() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode, blocked): still allow this one reload.
  }
  window.location.reload();
  return true;
}
