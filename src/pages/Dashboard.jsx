import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, Grid, Divider, IconButton, Collapse,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import tutorialRegistry, {
  getCategories, getSubcategories, getCategoryIcon,
} from '../features/tutorials/tutorialRegistry';

export default function Dashboard() {
  const navigate = useNavigate();
  const categories = getCategories();
  const [open, setOpen] = useState(() =>
    Object.fromEntries(categories.map((c) => [c, true]))
  );

  const toggle = (cat) => setOpen((p) => ({ ...p, [cat]: !p[cat] }));

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Dashboard</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Pick a topic and start learning. Real scenarios, not textbook definitions.
      </Typography>

      {categories.map((cat) => {
        const CatIcon = getCategoryIcon(cat);
        const subcategories = getSubcategories(cat);
        const count = tutorialRegistry.filter((t) => t.category === cat).length;

        return (
          <Box key={cat} sx={{ mb: 4 }}>
            <Box
              onClick={() => toggle(cat)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
                cursor: 'pointer', userSelect: 'none',
                '&:hover .toggle-icon': { color: 'primary.main' },
              }}
            >
              <CatIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ flexGrow: 1 }}>{cat}</Typography>
              <Chip label={`${count} topics`} size="small" sx={{ fontSize: '0.7rem' }} />
              <IconButton size="small" className="toggle-icon" sx={{ color: 'text.secondary' }}>
                {open[cat] ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Collapse in={open[cat]} timeout="auto">
              {subcategories.map((sub) => (
                <Box key={sub} sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2" color="text.secondary"
                    sx={{ mb: 1.5, pl: 0.5, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}
                  >
                    {sub}
                  </Typography>
                  <Grid container spacing={2}>
                    {tutorialRegistry
                      .filter((t) => t.category === cat && t.subcategory === sub)
                      .map((t, i) => {
                        const Icon = t.icon;
                        return (
                          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                            <Box
                              onClick={() => navigate(`/tutorials/${t.id}`)}
                              sx={{
                                p: 2.5, borderRadius: 3, bgcolor: 'background.paper',
                                border: '1px solid', borderColor: 'divider', cursor: 'pointer',
                                transition: 'all 0.3s ease', height: '100%',
                                animation: `cardIn 0.4s ease ${i * 0.08}s both`,
                                '@keyframes cardIn': {
                                  from: { opacity: 0, transform: 'translateY(12px)' },
                                  to: { opacity: 1, transform: 'translateY(0)' },
                                },
                                '&:hover': {
                                  transform: 'translateY(-3px)',
                                  boxShadow: '0 8px 30px var(--card-shadow)',
                                  borderColor: 'primary.main',
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Icon sx={{ color: 'primary.main', fontSize: 24 }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t.title}</Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6, fontSize: '0.82rem' }}>
                                {t.description}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {t.tags.map((tag) => (
                                  <Chip key={tag} label={tag} size="small" variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 22, borderColor: 'divider' }} />
                                ))}
                              </Box>
                            </Box>
                          </Grid>
                        );
                      })}
                  </Grid>
                </Box>
              ))}
            </Collapse>
            <Divider sx={{ mt: 1 }} />
          </Box>
        );
      })}
    </Box>
  );
}
