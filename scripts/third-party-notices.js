// Vite build plugin: writes dist/third-party-licenses.txt with the copyright notice and license text of
// every npm package bundled into the site, and fails the build if a package's license isn't allowed.
// The list comes from the finished bundle, so it always matches what the site ships.
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_FILE = 'third-party-licenses.txt';

// Permissive licenses: they ask only for attribution, which the generated file provides. Anything else
// (GPL, LGPL, AGPL, MPL-only, EUPL, CC BY-SA, or no license at all) stops the build until someone reviews
// it, then removes the package or adds the license here.
const ALLOWED = new Set([
  'MIT', 'MIT-0', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD',
  'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0', 'Zlib', 'OFL-1.1',
]);

// Packages whose package.json has no license field. Each was checked by hand.
const LICENSE_OVERRIDES = {
  khroma: 'MIT', // its license file is the MIT license
};

// Shipped outside the Vite bundle: vite-plugin-pwa copies these Workbox modules into the service worker
// (sw.js and workbox-*.js). Keep in sync with the Workbox features used in vite.config.js.
const SERVICE_WORKER_PACKAGES = [
  'workbox-core', 'workbox-routing', 'workbox-strategies', 'workbox-precaching',
  'workbox-expiration', 'workbox-cacheable-response',
];

// Standard license texts (relative to the project root), appended for packages that ship without a
// license file, such as the Firebase SDK.
const STANDARD_TEXTS_DIR = 'scripts/license-texts';

const LICENSE_FILE = /^(licen[cs]e|copying)([.-][\w.-]*)?$/i;
const NOTICE_FILE = /^notice(\.(md|txt))?$/i;
const COPYRIGHT_LINE = /Copyright (?:\(c\) )?\d{4}(?:\s*[-–]\s*\d{4})?,? ([^\n*]+)/gi;
const NODE_MODULES = '/node_modules/';

const toFile = (moduleId) => moduleId.replace(/^\0/, '').split('?')[0].replace(/\\/g, '/');
const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();

/** `…/node_modules/@scope/name/dist/x.js` → `…/node_modules/@scope/name` */
function packageDir(file) {
  const at = file.lastIndexOf(NODE_MODULES);
  if (at === -1) return null;
  const [first, second] = file.slice(at + NODE_MODULES.length).split('/');
  return file.slice(0, at + NODE_MODULES.length) + (first.startsWith('@') ? `${first}/${second}` : first);
}

function licenseOf(pkg) {
  if (LICENSE_OVERRIDES[pkg.name]) return LICENSE_OVERRIDES[pkg.name];
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

/** SPDX expressions such as "(MPL-2.0 OR Apache-2.0)" pass when one alternative is fully allowed. */
function isAllowed(expression) {
  return expression.replace(/[()]/g, '').split(/\s+OR\s+/i)
    .some((option) => option.split(/\s+AND\s+/i).every((id) => ALLOWED.has(id.trim())));
}

/** Copyright holders named in the headers of the bundled source files, e.g. "Google LLC". */
function copyrightHolders(files) {
  const holders = new Set();
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const [, holder] of fs.readFileSync(file, 'utf8').matchAll(COPYRIGHT_LINE)) {
      holders.add(holder.trim().replace(/[.,;]+$/, ''));
    }
  }
  return [...holders];
}

function readPackage(dir, bundledFiles) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const files = fs.readdirSync(dir);
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const texts = [...files.filter((f) => LICENSE_FILE.test(f)), ...files.filter((f) => NOTICE_FILE.test(f))]
    .map((f) => readText(path.join(dir, f)));
  return {
    name: pkg.name,
    version: pkg.version,
    license: licenseOf(pkg),
    url: pkg.homepage || repo?.replace(/^git\+/, '').replace(/\.git$/, '') || `https://www.npmjs.com/package/${pkg.name}`,
    texts,
    holders: texts.length ? [] : copyrightHolders(bundledFiles),
  };
}

function render(packages, standardTexts) {
  const line = '='.repeat(80);
  const summary = packages.map((p) => `  ${`${p.name} ${p.version}`.padEnd(52)} ${p.license}`).join('\n');
  const body = (p) => {
    if (p.texts.length) return p.texts.join('\n\n');
    const copyright = p.holders.length
      ? `Copyright ${p.holders.join('; ')} (from the copyright headers in the package's source files).\n`
      : '';
    const full = standardTexts.has(p.license)
      ? `The full ${p.license} text is at the end of this file.`
      : 'No license text is available.';
    return `${copyright}This package includes no license file. Its package.json declares ${p.license}. ${full}`;
  };
  const details = packages.map((p) => [line, `${p.name} ${p.version}`, `License: ${p.license}`, p.url, '', body(p)].join('\n'));
  const appendix = [...standardTexts].map(([id, text]) => [line, `Full text: ${id}`, line, '', text].join('\n'));

  return `Third-party software in ArchNorth
================================

ArchNorth (https://github.com/VinayakSV/ArchNorth) ships the ${packages.length} open-source packages below.
This file is generated from each build, so it matches the files the site serves.
Each package's copyright notice and license text follows the summary.

Summary
-------
${summary}

${[...details, ...appendix].join('\n\n')}
`;
}

export default function thirdPartyNotices() {
  let root;
  return {
    name: 'third-party-notices',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    generateBundle(_options, bundle) {
      // package directory → the files from it that made it into the bundle
      const bundled = new Map(SERVICE_WORKER_PACKAGES.map((name) => [path.join(root, 'node_modules', name), []]));
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const [id, mod] of Object.entries(chunk.modules)) {
          // Imported CSS (such as the font packages) renders as empty JS, so it counts even at length 0.
          if (mod.renderedLength === 0 && !/\.css($|\?)/.test(id)) continue;
          const file = toFile(id);
          const dir = packageDir(file);
          if (!dir) continue;
          if (!bundled.has(dir)) bundled.set(dir, []);
          bundled.get(dir).push(file);
        }
      }

      const byKey = new Map();
      for (const [dir, files] of bundled) {
        const pkg = readPackage(dir, files);
        byKey.set(`${pkg.name}@${pkg.version}`, pkg);
      }
      const packages = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

      const rejected = packages.filter((p) => !isAllowed(p.license));
      if (rejected.length) {
        this.error(`These bundled packages don't have an allowed license:\n${
          rejected.map((p) => `  ${p.name}@${p.version}: ${p.license}`).join('\n')
        }\nReview each license, then remove the package or update ALLOWED / LICENSE_OVERRIDES in scripts/third-party-notices.js.`);
      }

      const standardTexts = new Map();
      for (const p of packages.filter((pkg) => !pkg.texts.length)) {
        const file = path.join(root, STANDARD_TEXTS_DIR, `${p.license}.txt`);
        if (fs.existsSync(file)) standardTexts.set(p.license, readText(file));
        else this.warn(`${p.name}@${p.version} has no license file, and ${STANDARD_TEXTS_DIR}/${p.license}.txt doesn't exist.`);
      }

      this.emitFile({ type: 'asset', fileName: OUTPUT_FILE, source: render(packages, standardTexts) });
    },
  };
}
