import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, Grid, Chip } from '@mui/material';
import { RocketLaunch, Code, Architecture, Storage, Speed, School } from '@mui/icons-material';

const highlights = [
  { icon: <Architecture sx={{ fontSize: 36 }} />, title: 'System Design', desc: 'Real-world designs — financial systems, microservices, caching & more' },
  { icon: <Code sx={{ fontSize: 36 }} />, title: 'Java Deep Dives', desc: 'HashMap internals, concurrency, Java 8 & 17 features with runnable examples' },
  { icon: <Storage sx={{ fontSize: 36 }} />, title: 'Scenario Based', desc: 'Not definitions — real scenarios explained so simply a kid could follow' },
  { icon: <Speed sx={{ fontSize: 36 }} />, title: 'Microservices', desc: 'Patterns, approaches, circuit breakers, saga, CQRS and more' },
  { icon: <School sx={{ fontSize: 36 }} />, title: 'DSA & Beyond', desc: 'Coming soon — DSA, AI, RAG, MCP with real project-based learning' },
  { icon: <RocketLaunch sx={{ fontSize: 36 }} />, title: 'Interactive Notes', desc: 'Take notes per tutorial — saved right into your repo, not lost in browser' },
];

const techTags = ['System Design', 'Java 8', 'Java 17', 'HashMap', 'Multithreading', 'Microservices', 'Caching', 'Financial Systems', 'Concurrency', 'DSA'];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 3, py: { xs: 6, md: 10 },
      }}>
        <Box sx={{
          animation: 'slideUp 0.7s ease',
          '@keyframes slideUp': {
            from: { opacity: 0, transform: 'translateY(40px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}>
          <Typography variant="h2" sx={{
            fontWeight: 800, mb: 2, fontSize: { xs: '2.2rem', md: '3.5rem' },
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--text-primary) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            ArchNorth
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1, maxWidth: 600, mx: 'auto', lineHeight: 1.8 }}>
            Your true north for system design, Java, and software architecture.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
            Real scenarios, interactive simulations, and interview prep — not textbook definitions.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mb: 4, maxWidth: 500, mx: 'auto' }}>
            {techTags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined"
                sx={{ fontSize: '0.75rem', borderColor: 'divider', color: 'text.secondary' }} />
            ))}
          </Box>

          <Button variant="contained" size="large" onClick={() => navigate('/home')}
            startIcon={<RocketLaunch />}
            sx={{
              px: 5, py: 1.5, fontSize: '1.1rem', borderRadius: 3,
              animation: 'pulse 2s ease infinite',
              '@keyframes pulse': {
                '0%, 100%': { boxShadow: '0 0 0 0 rgba(127, 191, 174, 0.4)' },
                '50%': { boxShadow: '0 0 0 14px rgba(127, 191, 174, 0)' },
              },
            }}>
            Enter
          </Button>
        </Box>

        <Container maxWidth="lg" sx={{ mt: 8 }}>
          <Grid container spacing={3}>
            {highlights.map((h, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={h.title}>
                <Box sx={{
                  p: 3, borderRadius: 3, bgcolor: 'background.paper',
                  border: '1px solid', borderColor: 'divider',
                  transition: 'all 0.3s ease', height: '100%',
                  animation: `slideUp 0.5s ease ${0.3 + i * 0.1}s both`,
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                }}>
                  <Box sx={{ color: 'primary.main', mb: 1.5 }}>{h.icon}</Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{h.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{h.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="caption" color="text.secondary">ArchNorth — Find your direction in tech ✨</Typography>
      </Box>
    </Box>
  );
}
