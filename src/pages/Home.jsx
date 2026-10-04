import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, Grid } from '@mui/material';
import { MenuBook, StickyNote2, Architecture, Hub, Code, Storefront } from '@mui/icons-material';

const JOURNEY_START = '/tutorials/journey-start';

const features = [
  { icon: <Storefront sx={{ fontSize: 40 }} />, title: 'The ShopNorth Journey', desc: 'One e-commerce product from idea to production — every topic in SDLC order', path: JOURNEY_START },
  { icon: <Architecture sx={{ fontSize: 40 }} />, title: 'System Design', desc: 'Financial systems, caching, classic designs with HLD & LLD diagrams', path: '/dashboard' },
  { icon: <Hub sx={{ fontSize: 40 }} />, title: 'Microservices', desc: 'Patterns, communication, distributed transactions, service discovery', path: '/dashboard' },
  { icon: <Code sx={{ fontSize: 40 }} />, title: 'Java Deep Dives', desc: 'HashMap, concurrency, Java 8 & 17 features with executable examples', path: '/dashboard' },
  { icon: <MenuBook sx={{ fontSize: 40 }} />, title: 'All Tutorials', desc: 'Browse all tutorials grouped by category and subcategory', path: '/tutorials' },
  { icon: <StickyNote2 sx={{ fontSize: 40 }} />, title: 'Notes', desc: 'Per-tutorial notes to capture your learnings as you go', path: '/notes' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ textAlign: 'center', py: { xs: 4, md: 8 } }}>
      <Box sx={{
        animation: 'slideUp 0.3s ease-out',
        '@keyframes slideUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}>
        <Typography variant="h3" sx={{
          fontWeight: 800, mb: 2, fontSize: { xs: '2rem', md: '3rem' },
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--text-primary) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Welcome Back 👋
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto', lineHeight: 1.7 }}>
          Your personal learning hub. Pick a topic and dive in.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" size="large" startIcon={<Storefront />} onClick={() => navigate(JOURNEY_START)}
            sx={{ px: 4, py: 1.5, fontSize: '1rem' }}>
            Start the ShopNorth Journey
          </Button>
          <Button variant="outlined" size="large" onClick={() => navigate('/dashboard')}
            sx={{ px: 4, py: 1.5, fontSize: '1rem' }}>
            Go to Dashboard
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mt: 6 }}>
        {features.map((f, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f.title}>
            <Box
              onClick={() => navigate(f.path)}
              sx={{
                p: 3, borderRadius: 3, bgcolor: 'background.paper', cursor: 'pointer',
                border: '1px solid', borderColor: 'divider', transition: 'all 0.3s ease',
                animation: `slideUp 0.3s ease-out ${0.05 + i * 0.04}s both`,
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 6, borderColor: 'primary.main' },
              }}
            >
              <Box sx={{ color: 'primary.main', mb: 2 }}>{f.icon}</Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>{f.title}</Typography>
              <Typography variant="body2" color="text.secondary">{f.desc}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
