import { lazy } from 'react';

// Counts loads the visible UI is waiting for (page chunks, tutorial content), so the
// top progress bar can show immediately — React keeps the old page on screen during
// a navigation transition, so without this nothing would visibly happen on click.
let waiting = 0;
const listeners = new Set();
const notify = () => queueMicrotask(() => listeners.forEach((listener) => listener()));

export const loadingTracker = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isLoading: () => waiting > 0,
};

/** Shows the progress bar until `promise` settles. Returns the same promise. */
export function trackLoading(promise) {
  waiting++;
  notify();
  const done = () => { waiting--; notify(); };
  promise.then(done, done);
  return promise;
}

/** React.lazy with a `preload()` method, so likely-next pages download before the click. */
export function lazyWithPreload(factory) {
  let promise = null;
  let loaded = false;

  const load = () => {
    if (!promise) {
      promise = factory().then(
        (module) => { loaded = true; return module; },
        (error) => { promise = null; throw error; },   // a later render can retry after a network error
      );
    }
    return promise;
  };

  const Component = lazy(() => (loaded ? load() : trackLoading(load())));
  Component.preload = () => load().catch(() => {});  // background preloads never surface errors
  return Component;
}

/** Runs `task` when the browser is idle, unless the visitor asked to save data or is on a very slow connection. */
export function whenIdle(task) {
  const connection = navigator.connection;
  if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) {
    return () => {};
  }
  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(task, { timeout: 2500 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 1200);
  return () => window.clearTimeout(handle);
}
