# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ArchNorth (repo/package name still references `tech-tutorial` / `TechTutor` in places) is a React + Vite single-page app: a personal learning hub of markdown tutorials on system design, LLD, Java, microservices, SQL, Docker, and Spring Boot, aimed at senior backend-engineer interview prep. It deploys as a static site to GitHub Pages under the `/ArchNorth/` base path.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
npm run lint      # eslint .
```

There is no test suite/runner configured in this repo. Verify changes with `npm run build` and manual checks in the dev server (`npm run dev`, app served at `/ArchNorth/`).

Deployment is automatic via `.github/workflows/deploy.yml` on every push to `master` (not `main`) — builds with Node 22 and deploys `dist/` to GitHub Pages.

The GitHub repo is public. Keep personal details and anything from real employers or customers out of tracked files: `docs/` is git-ignored for private notes, which live outside the repo. Tutorial content uses generic examples.

- **Commits:** this repo commits as `VinayakSV <archnorth.learn@gmail.com>` (set in the repo-local git config). Commit only with this identity.
- **Study plan:** the owner's personal study plan is not in the code. `ProgressTracker.jsx` ships a neutral default, and a personal plan is imported from a JSON file into localStorage.
- **Feedback:** feedback is email-only, with no backend. The address and subject prefix live in `src/lib/feedback.js`. Links appear on the `/feedback` page (in the sidebar) and at the end of every tutorial.
  - `mailto:` alone often fails on Windows desktops (no configured mail app, or Firefox set to "always ask"). So `FeedbackActions` opens a menu: Gmail web compose, Outlook.com web compose, the visitor's mail app (`mailto:` with CRLF line breaks), and "copy message text".
  - "Copy address" is always visible.

## Architecture

### Tutorial content system (the core mechanism)

Tutorials are markdown files loaded dynamically — understanding this pipeline is required before touching content or the tutorial viewer:

1. **Metadata lives in code**: `src/features/tutorials/tutorialRegistry.js` is the single source of truth for all tutorial metadata (id, title, description, category, subcategory, icon, tags). It exports lookup helpers (`getTutorialById`, `getCategories`, `getTutorialsByCategory`, `getAdjacentTutorials`, `getCategoryIcon`).
2. **Content lives in markdown**: `src/content/<category>/<id>/<id>.md`. The folder name and the `.md` filename must both match the registry `id` exactly — this is how content is discovered.
3. **Discovery is glob-based, not import-based**: `src/pages/TutorialDetail.jsx` builds a module map at load time with `import.meta.glob('../content/**/*.md', { query: '?raw', import: 'default' })`, indexes it by parent folder name, then resolves a tutorial id to its markdown key at runtime (with an in-memory cache). A tutorial with no matching file falls back to a "Coming Soon" placeholder rather than erroring — so a registry entry with no `.md` file is a valid (if incomplete) state, not a bug.
4. **Sub-pages**: a tutorial folder can contain more than one `.md` file; in-content links (`[text](./other-file.md)`) are intercepted by `MarkdownViewer`'s `onNavigate` and routed through the same glob-based loader without a page navigation.
5. **Links to other tutorials**: `[text](/tutorials/<id>)` is rendered by `MarkdownViewer` as a React Router link (in-app, same tab; the basename is added automatically). Any other link opens in a new tab. `Layout.jsx` resets the content scroll position on every route change.

Registry array order is the sidebar order *and* the Prev/Next order (`getAdjacentTutorials`), so keep each category and subcategory contiguous in `tutorialRegistry.js`.

To add a tutorial: create `src/content/<category>/<id>/<id>.md` following the Content Authoring Guide in README.md, then add a matching entry to `tutorialRegistry.js` (and update `getCategoryIcon()` if it's a new category). Also end it with a ShopNorth Journey box (see below).

### The ShopNorth Journey (the main story)

The first category, **ShopNorth Journey** (`src/content/journey/`, ids `journey-start` and `journey-01-…` to `journey-15-…`), follows one fictional e-commerce product through the whole SDLC: requirements → HLD → LLD → SQL → Spring Boot → microservices → security → testing → code quality → Docker → CI/CD → Kubernetes → Datadog → launch/incidents → AI. Chapters share one consistent story world (team: Ananya PM, Priya tech lead, Arjun, Rohan, Meera QA, Kabir SRE; sale-day numbers: 3,000 req/s, 150 orders/s; order states and schema from Chapters 3-4). Keep new content consistent with it.

Each chapter opens and closes with a `callout-journey` block (orange, deliberately louder than other callouts) and has "Go Deeper" links to topic tutorials. Every other tutorial ends with a journey box between `<!-- journey-link:start -->` and `<!-- journey-link:end -->` markers, saying how ShopNorth uses that topic and linking to the matching chapter (tutorials not in the main story are labeled "Extra case study"). New tutorials need one too.

### Content authoring conventions (non-negotiable structure, per README/CONTRIBUTING)

Every tutorial follows a fixed shape: opening analogy (no textbook definitions) → scenario-driven concepts with real-world entities (never Foo/Bar) → mandatory callout boxes → a dedicated "🎯 Interview Corner" section with 3-5 interview questions → optional quick-reference table → closing golden-rule blockquote. Callouts are raw HTML divs (markdown doesn't apply classes), require a blank line after the opening tag, and map to fixed classes styled in `MarkdownViewer.jsx`: `callout-scenario` (purple), `callout-tip` (green), `callout-interview` (red), `callout-info` (blue), `callout-warn` (yellow), and `callout-journey` (orange, ShopNorth Journey only). The full authoring prompt and checklist are in README.md — follow it exactly when writing or editing tutorial content, since `callout-interview` blocks are also parsed programmatically (see below).

Newer tutorials (SQL indexing, core Java, Spring Boot, DSA, Kubernetes, AI Engineering) also add a "🏋️ Practice Assignments" section with 🟢 Low / 🟡 Medium / 🔴 High questions, and a "🛠️ Mini Project" section before the Interview Corner. Answers go in collapsible `<details><summary>Show answer</summary> ... </details>` blocks (styled in `MarkdownViewer.jsx`), which also need blank lines inside for markdown to render. Don't nest `<div>`s inside `callout-interview` blocks: the extraction regex stops at the first `</div>`.

### Rendering pipeline

`MarkdownViewer.jsx` renders content via `react-markdown` + `remark-gfm` + `rehype-raw` (raw HTML needed for callout divs), with `react-syntax-highlighter` for code blocks and `MermaidDiagram.jsx` for fenced ` ```mermaid ` blocks.

Performance constraints (tutorial navigation used to take 4-9 s; these fixes brought it under 1 s):
- Syntax highlighting uses `PrismLight` with `useInlineStyles={false}`; the oneDark/oneLight themes are converted once into CSS token selectors. Per-token inline styles cost ~1 s per long page. Only the grammars registered at the top of `MarkdownViewer.jsx` are bundled — a new fence language needs a `registerLanguage` entry (or a `LANG_ALIASES` mapping), otherwise it renders unhighlighted. Don't add `react-syntax-highlighter` back to `manualChunks` in `vite.config.js`; that pulls in every Prism language.
- Mermaid diagrams render lazily via IntersectionObserver against the scrolling content container (not the window), so off-screen diagrams don't block navigation.
- `TutorialDetail`'s `onNavigate` callback must keep a stable identity, or the memoized `MarkdownViewer` re-renders the previous tutorial on every click.

`TutorialDetail.jsx` extracts `callout-interview` blocks from the loaded markdown via regex (`extractInterviewBlocks`) to drive both the floating `InterviewPanel` and fullscreen `FlashcardMode` (Q parsed from `**Q: "..."**`, answer is the remaining block text). Changing the callout-interview HTML shape will break both features. The question text can't contain double quotes (the parser stops at the first `"`), and a block without a `**Q:` line shows up as a generic "Question N" flashcard. Write new interview blocks as `**Q: "..."**`, a blank line, then the answer.

### Simulations

`src/components/common/simulations/simulationConfigs.js` defines per-topic animated SVG simulations (nodes, connections, step-by-step packet animations) rendered by `SimulationViewer.jsx`. `simulationMap` (keyed by tutorial id) in that file controls which tutorials get a simulation; `TutorialDetail.jsx` looks up `simulationMap[id]` and renders it above the markdown content when present.

### SQL Playground

`SqlPlayground.jsx` (lazy-loaded) uses `sql.js` (WASM SQLite) to run an in-browser, seeded airline-domain database (airlines/airports/flights/passengers/bookings/routes) for hands-on query practice. It's shown automatically for a hardcoded set of tutorial ids (`SQL_TUTORIAL_IDS` in `TutorialDetail.jsx`) — add new SQL tutorial ids to that set to get the playground.

The engine file is imported locally (`sql.js/dist/sql-wasm-browser.wasm?url`), not from a CDN: the browser build of sql.js requests `sql-wasm-browser.wasm`, and a CDN pinned to another version 404s. The seed data (`INIT_SQL`) runs with `PRAGMA foreign_keys = ON`, so any seed row referencing a missing parent breaks the whole playground — keep references valid when editing it. SQL practice answers in tutorials are meant to run against this seed data; mark PostgreSQL-only answer blocks with a leading `-- postgres` comment.

### Auth (owner-only routes)

`src/lib/firebase.js` configures Firebase Auth (Google sign-in only). `OwnerRoute.jsx` gates a route to a single owner by Firebase Auth user ID (`OWNER_UID`). The UID is not secret and reveals no email; never put the owner's email back in the code. Any other authenticated account is force-signed-out via an effect (never during render). Currently only `/progress` (`ProgressTracker.jsx`) is owner-gated. This is single-user auth, not a general auth system — don't generalize it without being asked.

Firebase must load only on that page: `src/pages/PrivateProgress.jsx` (lazy, in `routes/pages.js`) wraps `ProgressTracker` in `OwnerRoute`, so the Firebase SDK sits in that page's chunk. Never import `OwnerRoute` or `lib/firebase` from an eagerly loaded module (App, Layout, Sidebar): Firebase would then start for every visitor and create IndexedDB databases on their device, which the privacy notice says doesn't happen.

### Routing & app shell

`App.jsx` defines all routes under `BrowserRouter basename="/ArchNorth"` matching Vite's `base: '/ArchNorth/'` in `vite.config.js`. `/` is the unauthenticated `Landing` page outside the main `Layout`; everything else (`/home`, `/dashboard`, `/tutorials`, `/tutorials/:id`, `/notes`, `/progress`, `/license`, `/feedback`) is nested under `Layout` (header/sidebar chrome).

Pages are code-split with `lazyWithPreload` (`src/lib/lazyWithPreload.js`), declared in `src/routes/pages.js`; each page has a `preload()`. Landing preloads Home on idle and on hover/touch of "Enter"; `Layout` preloads the likely-next pages on idle (skipped with Save-Data or 2G). `Layout` wraps `<Outlet />` in its own `Suspense`, so header and sidebar stay on screen while a page loads.

Loading UI is one consistent design, so use it instead of raw MUI spinners:
- `AppLoader` (`components/common/AppLoader.jsx`): the compass loader, with variants `fullscreen`, `page`, `section`, and `inline`. It fades in after 150 ms, so fast loads don't flash.
- `RouteProgressBar`: the thin top bar. It shows while anything registered with `trackLoading(promise)` is pending; page chunks register automatically, and TutorialDetail registers markdown loads. React Router runs navigations as transitions and keeps the old page on screen, so the bar is the only immediate feedback on click.
- `index.html`: an inline boot loader (the same compass) inside `#root`, plus an early script that applies the saved theme before first paint.

Small spinners inside buttons (e.g. the SQL "Run" button) stay as `CircularProgress`.

**Never a blank screen.** `ErrorBoundary` wraps the routes twice: in `App.jsx` (full-screen fallback) and in `Layout` around the page (header and sidebar keep working). Both reset when the path changes. Unknown URLs and unknown tutorial IDs render `NotFound`.

The common real-world failure is a **stale deployment**. The PWA (`registerType: 'autoUpdate'`) lets a new service worker take over open tabs and delete old precached files, so the tab's next lazy import 404s. `src/lib/staleVersion.js` detects these chunk-load errors. The error boundary, the `vite:preloadError` listener in `main.jsx`, and TutorialDetail's markdown loader all call `reloadForNewVersion()`, which reloads at most once a minute and never when offline. Otherwise they show a message with Reload / Go to Home.

The sidebar footer shows the build time (`VITE_BUILD_TIME`, defined in `vite.config.js`), so you can tell which version a browser is actually running.

### State & persistence

No backend/database — all user state (per-tutorial notes, global notes, progress-tracker checkboxes) is `localStorage`-backed with keys prefixed `archnorth-*` (see `NOTES_KEY` etc. in each page). `main.jsx` auto-migrates legacy `tech-tutorial-*` keys to `archnorth-*` on first load — a leftover from the app's rename from "TechTutor"/"zero-to-architect"; keep that migration in mind if touching localStorage key names again.

### Build config specifics

`vite.config.js` sets manual chunk splitting (`vendor-react`, `vendor-mui`, `vendor-markdown`, `vendor-mermaid`), excludes `sql.js` from dep pre-bundling (it's WASM), and includes `assetsInclude: ['**/*.md']`. PWA is configured via `vite-plugin-pwa` with `autoUpdate` registration, runtime caching for the WASM engine and font files, and `navigateFallbackDenylist: [/\.txt$/]` so `third-party-licenses.txt` opens as a file instead of the app shell — `base`/`scope`/`start_url` must all stay in sync at `/ArchNorth/` when changing the deploy path. The favicon is `public/pwa-icon.svg`.

Fonts are self-hosted: `main.jsx` imports `@fontsource-variable/inter` and `@fontsource-variable/fira-code`, which register the families **"Inter Variable"** and **"Fira Code Variable"**. Use the `FONT_SANS` / `FONT_MONO` stacks exported from `src/theme/theme.js` (the oneDark/oneLight code themes name plain "Fira Code", so `MarkdownViewer` overrides their font). Don't add Google Fonts or any other third-party request back: the privacy notice says pages contact no font service.

## Licensing split (relevant when adding/editing files)

Code (everything outside `src/content/`) is MIT. Everything under `src/content/` (tutorial markdown, diagrams, embedded examples) is CC BY-NC-SA 4.0, per README.md and `LICENSE-CONTENT`.

Third-party notices are generated, not hand-maintained: the Vite plugin `scripts/third-party-notices.js` writes `dist/third-party-licenses.txt` from the modules actually in the bundle, plus the Workbox packages copied into the service worker (`SERVICE_WORKER_PACKAGES`). It **fails the build** when a shipped package's license isn't in its permissive `ALLOWED` set; review the license before adding anything there, and record packages with no `license` field in `LICENSE_OVERRIDES`. Packages that ship no license file (the Firebase SDK) get their copyright lines from the bundled source headers, and their full license text from `scripts/license-texts/<SPDX id>.txt`.

The License page (`src/pages/LicenseReport.jsx`, route `/license`) is the public legal and privacy notice. Keep it, the README's Privacy and License & Legal sections, and the actual behavior in sync. Any change to what the site stores on a device or which third parties it contacts (analytics, fonts, sign-in, hosting) needs a matching update there, plus a new "Last reviewed" date.
