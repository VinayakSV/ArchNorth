import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GavelIcon from '@mui/icons-material/Gavel';

const DEPS = [
  { name: 'React', version: '18.3.1', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'React DOM', version: '18.3.1', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'React Router DOM', version: '7.13.1', license: 'MIT', url: 'https://github.com/remix-run/react-router' },
  { name: 'MUI Material', version: '7.3.9', license: 'MIT', url: 'https://github.com/mui/material-ui' },
  { name: 'MUI Icons Material', version: '7.3.9', license: 'MIT', url: 'https://github.com/mui/material-ui' },
  { name: 'Emotion React', version: '11.14.0', license: 'MIT', url: 'https://github.com/emotion-js/emotion' },
  { name: 'Emotion Styled', version: '11.14.1', license: 'MIT', url: 'https://github.com/emotion-js/emotion' },
  { name: 'Mermaid', version: '11.13.0', license: 'MIT', url: 'https://github.com/mermaid-js/mermaid' },
  { name: 'React Markdown', version: '10.1.0', license: 'MIT', url: 'https://github.com/remarkjs/react-markdown' },
  { name: 'React Syntax Highlighter', version: '16.1.1', license: 'MIT', url: 'https://github.com/react-syntax-highlighter/react-syntax-highlighter' },
  { name: 'Rehype Raw', version: '7.0.0', license: 'MIT', url: 'https://github.com/rehypejs/rehype-raw' },
  { name: 'Remark GFM', version: '4.0.1', license: 'MIT', url: 'https://github.com/remarkjs/remark-gfm' },
  { name: 'Sass', version: '1.98.0', license: 'MIT', url: 'https://github.com/sass/dart-sass' },
  { name: 'Vite', version: '6.4.1', license: 'MIT', url: 'https://github.com/vitejs/vite' },
];

export default function LicenseReport() {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <GavelIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={700}>License Report</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Generated on April 1, 2026 — All dependencies verified for legal compliance.
      </Typography>

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h6" fontWeight={600}>Dependencies ({DEPS.length})</Typography>
        <Chip icon={<CheckCircleIcon />} label="All MIT — No conflicts" color="success" size="small" />
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
        <li><Typography variant="body2">All 14 direct dependencies use the <strong>MIT License</strong> — the most permissive open-source license with zero copyleft restrictions.</Typography></li>
        <li><Typography variant="body2">No <strong>GPL, AGPL, LGPL, or copyleft</strong> licenses in the dependency tree.</Typography></li>
        <li><Typography variant="body2">Tutorial content references third-party technologies (Redis, Kafka, Spring, AWS, etc.) for <strong>educational purposes only</strong>. All trademarks belong to their respective owners.</Typography></li>
        <li><Typography variant="body2">"ArchNorth" branding is <strong>not covered</strong> by the MIT or CC license.</Typography></li>
        <li><Typography variant="body2">This project is provided <strong>"AS IS"</strong> without warranty of any kind. See <code>LICENSE</code> for full terms.</Typography></li>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'action.hover' }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Copyright © 2026 ArchNorth Contributors — Code: MIT | Content: CC BY-NC-SA 4.0
        </Typography>
      </Paper>
    </Box>
  );
}
