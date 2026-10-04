import { memo, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import nginx from 'react-syntax-highlighter/dist/esm/languages/prism/nginx';
import protobuf from 'react-syntax-highlighter/dist/esm/languages/prism/protobuf';
import lua from 'react-syntax-highlighter/dist/esm/languages/prism/lua';
import gherkin from 'react-syntax-highlighter/dist/esm/languages/prism/gherkin';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import hcl from 'react-syntax-highlighter/dist/esm/languages/prism/hcl';
import properties from 'react-syntax-highlighter/dist/esm/languages/prism/properties';
import { Box, Typography } from '@mui/material';
import MermaidDiagram from './MermaidDiagram';
import useThemeMode from '../../hooks/useThemeMode';
import { FONT_MONO } from '../../theme/theme';

// Only these grammars are bundled; add one here when content uses a new fence language.
Object.entries({
  java, sql, bash, yaml, docker, python, json, markup, javascript, jsx,
  typescript, markdown, nginx, protobuf, lua, gherkin, go, hcl, properties,
}).forEach(([name, grammar]) => SyntaxHighlighter.registerLanguage(name, grammar));

const LANG_ALIASES = {
  dockerfile: 'docker', xml: 'markup', html: 'markup', sh: 'bash', shell: 'bash', console: 'bash',
  yml: 'yaml', js: 'javascript', ts: 'typescript', md: 'markdown', terraform: 'hcl', golang: 'go',
};

// Per-token inline styles in react-syntax-highlighter cost ~1s per long page, so tokens
// render with class names and the theme is applied once as CSS on the container.
const SKIPPED_THEME_KEYS = /selection|toolbar|line-|prism-previewer|rainbow|diff-highlight|^token\.|^:not|^(pre|code)\[/;

function themeToTokenSx(theme) {
  const sx = {};
  for (const [key, style] of Object.entries(theme)) {
    if (SKIPPED_THEME_KEYS.test(key)) continue;
    const selector = key.startsWith('.') ? `& ${key}` : `& .token.${key}`;
    sx[selector] = style;
  }
  return sx;
}

const CODE_THEMES = {
  dark: {
    tokens: themeToTokenSx(oneDark),
    pre: { ...oneDark['pre[class*="language-"]'], margin: 0, borderRadius: 0, fontSize: '0.8rem', fontFamily: FONT_MONO },
    code: { ...oneDark['code[class*="language-"]'], fontFamily: FONT_MONO },
  },
  light: {
    tokens: themeToTokenSx(oneLight),
    pre: { ...oneLight['pre[class*="language-"]'], margin: 0, borderRadius: 0, fontSize: '0.8rem', fontFamily: FONT_MONO },
    code: { ...oneLight['code[class*="language-"]'], fontFamily: FONT_MONO },
  },
};

const markdownSx = {
  '& h1': { fontSize: { xs: '1.5rem', sm: '2rem' }, fontWeight: 700, mt: 4, mb: 2, color: 'primary.main' },
  '& h2': { fontSize: { xs: '1.25rem', sm: '1.6rem' }, fontWeight: 600, mt: 3, mb: 1.5, color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', pb: 1 },
  '& h3': { fontSize: { xs: '1.1rem', sm: '1.3rem' }, fontWeight: 600, mt: 2.5, mb: 1, color: 'text.primary' },
  '& h4': { fontSize: { xs: '1rem', sm: '1.1rem' }, fontWeight: 600, mt: 2, mb: 1 },
  '& p': { mb: 2, lineHeight: 1.8, color: 'text.secondary', fontSize: { xs: '0.9rem', sm: '1rem' } },
  '& ul, & ol': { pl: { xs: 2, sm: 3 }, mb: 2, color: 'text.secondary' },
  '& li': { mb: 0.5, lineHeight: 1.7, fontSize: { xs: '0.9rem', sm: '1rem' } },
  '& blockquote': {
    borderLeft: '4px solid', borderColor: 'primary.main',
    pl: 2, py: 0.5, my: 2, bgcolor: 'action.hover', borderRadius: '0 8px 8px 0',
  },
  '& table': { width: '100%', borderCollapse: 'collapse', my: 2, display: 'block', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  '& th, & td': { border: '1px solid', borderColor: 'divider', p: { xs: 0.75, sm: 1.5 }, textAlign: 'left', fontSize: { xs: '0.78rem', sm: '0.875rem' } },
  '& th': { bgcolor: 'action.hover', fontWeight: 600 },
  '& code:not(pre code)': {
    bgcolor: 'var(--code-bg)', px: 0.8, py: 0.2, borderRadius: 1,
    fontSize: '0.875em', fontFamily: FONT_MONO,
  },
  '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 3 },
  '& img': { maxWidth: '100%', borderRadius: 2 },
  '& strong': { color: 'text.primary' },
  '& .callout-info, & .callout-warn, & .callout-tip, & .callout-scenario, & .callout-interview': {
    p: 2, my: 2, borderRadius: 2, border: '1px solid',
    animation: 'calloutIn 0.4s ease both',
    '@keyframes calloutIn': {
      from: { opacity: 0, transform: 'translateX(-8px)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
  },
  '& .callout-info': { borderColor: '#4a90d9', bgcolor: 'rgba(74,144,217,0.08)', borderLeft: '4px solid #4a90d9' },
  '& .callout-warn': { borderColor: '#d9a04a', bgcolor: 'rgba(217,160,74,0.08)', borderLeft: '4px solid #d9a04a' },
  '& .callout-tip': { borderColor: '#4a7c6f', bgcolor: 'rgba(74,124,111,0.08)', borderLeft: '4px solid #4a7c6f' },
  '& .callout-scenario': { borderColor: '#9b59b6', bgcolor: 'rgba(155,89,182,0.08)', borderLeft: '4px solid #9b59b6' },
  '& .callout-interview': { borderColor: '#e74c3c', bgcolor: 'rgba(231,76,60,0.06)', borderLeft: '4px solid #e74c3c' },
  // The ShopNorth Journey (main story) — deliberately louder than the other callouts.
  '& .callout-journey': {
    p: 2.5, my: 3, borderRadius: 3, border: '2px solid #e67e22', borderLeft: '6px solid #e67e22',
    background: 'linear-gradient(135deg, rgba(230,126,34,0.16) 0%, rgba(230,126,34,0.05) 100%)',
    boxShadow: '0 2px 12px rgba(230,126,34,0.15)',
    '& > p:first-of-type': { mt: 0 },
    '& > :last-child': { mb: 0 },
  },
  // "📍 SDLC stage" line at the top of every topic: where it fits in the lifecycle (and the ShopNorth chapter).
  '& .sdlc-stage': {
    px: 1.75, py: 1, mb: 3, borderRadius: 2, border: '1px dashed #e67e22',
    bgcolor: 'rgba(230,126,34,0.07)',
    '& p': { m: 0, fontSize: { xs: '0.82rem', sm: '0.9rem' }, lineHeight: 1.6 },
  },
  '& details': {
    my: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
    bgcolor: 'background.paper', overflow: 'hidden',
  },
  '& details > summary': {
    cursor: 'pointer', px: 2, py: 1, fontWeight: 600, fontSize: '0.9rem',
    color: 'primary.main', bgcolor: 'action.hover', userSelect: 'none',
  },
  '& details[open] > summary': { borderBottom: '1px solid', borderColor: 'divider' },
  '& details > :not(summary)': { mx: 2 },
  '& details > :last-child': { mb: 2 },
  '& .step': {
    p: 2, my: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
    bgcolor: 'background.paper',
    animation: 'stepIn 0.3s ease both',
    '@keyframes stepIn': {
      from: { opacity: 0, transform: 'translateY(8px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
  },
};

const IN_APP_LINK_SX = {
  color: 'primary.main', cursor: 'pointer', textDecoration: 'underline',
  fontWeight: 600, '&:hover': { color: 'primary.dark' },
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];

const MarkdownViewer = memo(function MarkdownViewer({ content, onNavigate }) {
  const { mode } = useThemeMode();
  const codeTheme = mode === 'dark' ? CODE_THEMES.dark : CODE_THEMES.light;
  const rootSx = useMemo(() => ({ ...markdownSx, ...codeTheme.tokens }), [codeTheme]);

  const components = useMemo(() => ({
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const lang = match?.[1];
      const codeStr = String(children).replace(/\n$/, '');

      if (lang === 'mermaid') return <MermaidDiagram chart={codeStr} />;

      return !inline && lang ? (
        <Box sx={{ my: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ px: 2, py: 0.5, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">{lang}</Typography>
          </Box>
          <SyntaxHighlighter
            useInlineStyles={false}
            language={LANG_ALIASES[lang] || lang}
            PreTag="div"
            customStyle={codeTheme.pre}
            codeTagProps={{ style: codeTheme.code }}
            {...props}
          >
            {codeStr}
          </SyntaxHighlighter>
        </Box>
      ) : (
        <code className={className} {...props}>{children}</code>
      );
    },
    a({ href, children, ...props }) {
      // Links to other tutorials (e.g. the ShopNorth Journey's "next chapter") navigate inside the app.
      if (href && /^\/tutorials\/[\w-]+$/.test(href)) {
        return <Box component={RouterLink} to={href} sx={IN_APP_LINK_SX} {...props}>{children}</Box>;
      }
      if (href && href.endsWith('.md')) {
        return (
          <Box
            component="a"
            onClick={(e) => { e.preventDefault(); onNavigate?.(href); }}
            sx={IN_APP_LINK_SX}
            {...props}
          >
            {children}
          </Box>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
  }), [codeTheme, onNavigate]);

  return (
    <Box sx={rootSx}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
});

export default MarkdownViewer;
