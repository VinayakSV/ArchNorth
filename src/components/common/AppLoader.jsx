import { Box, Typography } from '@mui/material';

// ArchNorth's loading indicator: a compass whose needle swings and settles toward north.
// The same drawing is inlined in index.html as the boot loader shown before React starts.
const compassSx = {
  display: 'block',
  flexShrink: 0,
  color: 'primary.main',
  '& .an-ring': { transformOrigin: '24px 24px', animation: 'an-spin 1.1s linear infinite' },
  '& .an-needle': { transformOrigin: '24px 24px', animation: 'an-seek 1.6s ease-in-out infinite' },
  '@keyframes an-spin': { to: { transform: 'rotate(360deg)' } },
  '@keyframes an-seek': {
    '0%, 100%': { transform: 'rotate(-35deg)' },
    '45%': { transform: 'rotate(18deg)' },
    '70%': { transform: 'rotate(-6deg)' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .an-ring, & .an-needle': { animation: 'none' },
  },
};

export function CompassIcon({ size = 44 }) {
  return (
    <Box component="svg" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" sx={compassSx}>
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <circle className="an-ring" cx="24" cy="24" r="21" fill="none" stroke="currentColor"
        strokeWidth="3" strokeLinecap="round" strokeDasharray="30 102" />
      <g className="an-needle">
        <polygon points="24,8 28.5,24 19.5,24" fill="currentColor" />
        <polygon points="24,40 28.5,24 19.5,24" fill="currentColor" fillOpacity="0.3" />
      </g>
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
    </Box>
  );
}

const VARIANTS = {
  fullscreen: { size: 56, sx: { minHeight: '100vh', bgcolor: 'background.default' } },
  page: { size: 44, sx: { minHeight: '45vh' } },
  section: { size: 40, sx: { py: 8 } },
  inline: { size: 20, sx: { py: 1.5, px: 2, flexDirection: 'row', justifyContent: 'flex-start' } },
};

/**
 * variant: 'fullscreen' (whole screen), 'page' (content area), 'section' (part of a page),
 * 'inline' (small, beside a text label).
 */
export default function AppLoader({ variant = 'page', label = 'Loading…' }) {
  const { size, sx } = VARIANTS[variant] || VARIANTS.page;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5,
        // Fade in after a moment, so loads that finish quickly don't flash a spinner.
        animation: variant === 'fullscreen' ? 'none' : 'an-appear 0.2s ease 0.15s both',
        '@keyframes an-appear': { from: { opacity: 0 }, to: { opacity: 1 } },
        ...sx,
      }}
    >
      <CompassIcon size={size} />
      <Typography variant={variant === 'inline' ? 'caption' : 'body2'} color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
