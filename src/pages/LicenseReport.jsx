import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Divider, Link } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GavelIcon from '@mui/icons-material/Gavel';
import { FEEDBACK_EMAIL } from '../lib/feedback';

const AUTHOR = 'VinayakSV';
const REPO_URL = 'https://github.com/VinayakSV/ArchNorth';

// Libraries that ship to the browser. Build tools (Vite, Sass, vite-plugin-pwa) are MIT-licensed and not shipped.
const DEPS = [
  { name: 'React', version: '18.3.1', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'React DOM', version: '18.3.1', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'React Router DOM', version: '7.13.2', license: 'MIT', url: 'https://github.com/remix-run/react-router' },
  { name: 'MUI Material', version: '7.3.9', license: 'MIT', url: 'https://github.com/mui/material-ui' },
  { name: 'MUI Icons Material', version: '7.3.9', license: 'MIT', url: 'https://github.com/mui/material-ui' },
  { name: 'Emotion React', version: '11.14.0', license: 'MIT', url: 'https://github.com/emotion-js/emotion' },
  { name: 'Emotion Styled', version: '11.14.1', license: 'MIT', url: 'https://github.com/emotion-js/emotion' },
  { name: 'Mermaid', version: '11.14.0', license: 'MIT', url: 'https://github.com/mermaid-js/mermaid' },
  { name: 'React Markdown', version: '10.1.0', license: 'MIT', url: 'https://github.com/remarkjs/react-markdown' },
  { name: 'React Syntax Highlighter', version: '16.1.1', license: 'MIT', url: 'https://github.com/react-syntax-highlighter/react-syntax-highlighter' },
  { name: 'Rehype Raw', version: '7.0.0', license: 'MIT', url: 'https://github.com/rehypejs/rehype-raw' },
  { name: 'Remark GFM', version: '4.0.1', license: 'MIT', url: 'https://github.com/remarkjs/remark-gfm' },
  { name: 'sql.js', version: '1.14.1', license: 'MIT', url: 'https://github.com/sql-js/sql.js' },
  { name: 'Firebase JS SDK', version: '12.12.1', license: 'Apache-2.0', url: 'https://github.com/firebase/firebase-js-sdk' },
  { name: 'Inter & Fira Code (fonts)', version: 'Google Fonts', license: 'OFL-1.1', url: 'https://fonts.google.com/' },
];

export default function LicenseReport() {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <GavelIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={700}>License, Credits & Privacy</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Last reviewed October 3, 2026.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {/* Credits */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Built by</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="body2">
          ArchNorth was designed, curated, and directed by{' '}
          <Link href="https://github.com/VinayakSV" target="_blank" rel="noopener noreferrer"><strong>{AUTHOR}</strong></Link>,
          and built with AI assistance. Source code:{' '}
          <Link href={REPO_URL} target="_blank" rel="noopener noreferrer">{REPO_URL.replace('https://', '')}</Link>.
        </Typography>
      </Paper>

      <Divider sx={{ mb: 3 }} />

      {/* Project Licensing */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Project Licensing</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 250 }}>
          <Typography variant="subtitle2" color="text.secondary">Source Code</Typography>
          <Typography variant="h6" fontWeight={600}>MIT License</Typography>
          <Typography variant="body2" color="text.secondary">Free to use, modify, distribute with attribution</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 250 }}>
          <Typography variant="subtitle2" color="text.secondary">Tutorial Content (src/content/)</Typography>
          <Typography variant="h6" fontWeight={600}>CC BY-NC-SA 4.0</Typography>
          <Typography variant="body2" color="text.secondary">Share with attribution, non-commercial, same license</Typography>
        </Paper>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Dependency Table */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" fontWeight={600}>Third-Party Libraries ({DEPS.length})</Typography>
        <Chip icon={<CheckCircleIcon />} label="All permissive — no copyleft" color="success" size="small" />
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Package</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Version</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>License</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Compatible</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {DEPS.map((dep, i) => (
              <TableRow key={dep.name} sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  <a href={dep.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {dep.name}
                  </a>
                </TableCell>
                <TableCell><code>{dep.version}</code></TableCell>
                <TableCell><Chip label={dep.license} size="small" variant="outlined" /></TableCell>
                <TableCell><CheckCircleIcon color="success" fontSize="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 3 }} />

      {/* Legal Notes */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Legal Notes</Typography>
      <Box component="ul" sx={{ pl: 2.5, '& li': { mb: 0.75 }, '& li::marker': { color: 'text.secondary' } }}>
        <li><Typography variant="body2">Every package that ships with the app (363 including transitive dependencies) uses a <strong>permissive license</strong>: MIT, Apache-2.0, ISC, BSD, 0BSD, or CC0. DOMPurify (used by Mermaid) is dual-licensed MPL-2.0 OR Apache-2.0 and is used under Apache-2.0.</Typography></li>
        <li><Typography variant="body2">No <strong>GPL, AGPL, LGPL, or other copyleft</strong> licenses in the shipped dependency tree.</Typography></li>
        <li><Typography variant="body2">Product and company names (Netflix, Uber, WhatsApp, Auth0, AWS, Redis, Kafka, Spring, and others) appear only to describe well-known systems and technologies for <strong>educational purposes</strong>. All trademarks belong to their respective owners. ArchNorth is <strong>not affiliated with or endorsed by</strong> any of them.</Typography></li>
        <li><Typography variant="body2">The “ArchNorth” name and branding are <strong>not covered</strong> by the MIT or CC license.</Typography></li>
        <li><Typography variant="body2">Tutorials are for learning and interview preparation, not professional advice. The project is provided <strong>“AS IS”</strong> without warranty of any kind. See <code>LICENSE</code> for full terms.</Typography></li>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Privacy */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Privacy</Typography>
      <Box component="ul" sx={{ pl: 2.5, '& li': { mb: 0.75 }, '& li::marker': { color: 'text.secondary' } }}>
        <li><Typography variant="body2"><strong>No account needed.</strong> Your notes and progress are saved only in your own browser (localStorage). They are never sent to a server.</Typography></li>
        <li><Typography variant="body2"><strong>Analytics:</strong> Google Analytics 4 runs in consent mode with all storage denied, so it sets no analytics or advertising cookies. Google still receives anonymous page-view pings, including your IP address and browser details, to count visits. Google&apos;s privacy policy applies to that data.</Typography></li>
        <li><Typography variant="body2"><strong>Fonts</strong> load from Google Fonts, so your browser contacts Google&apos;s servers when the page loads.</Typography></li>
        <li><Typography variant="body2"><strong>Sign-in</strong> (Google, via Firebase) exists only for the site owner&apos;s private page. Visitors never need to sign in.</Typography></li>
        <li><Typography variant="body2"><strong>Feedback</strong> is sent by email from your own mail app. Your address and message are seen only by the site owner, used only to reply and improve ArchNorth, and never shared.</Typography></li>
        <li><Typography variant="body2">Questions or removal requests: email <Link href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</Link>.</Typography></li>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'action.hover' }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Copyright © 2026 {AUTHOR} — Code: MIT | Content: CC BY-NC-SA 4.0
        </Typography>
      </Paper>
    </Box>
  );
}
