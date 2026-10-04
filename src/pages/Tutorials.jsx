import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, List, ListItemButton, ListItemIcon, ListItemText,
  Chip, IconButton, Collapse,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import tutorialRegistry, {
  getCategories, getSubcategories, getCategoryIcon,
} from '../features/tutorials/tutorialRegistry';

export default function Tutorials() {
  const navigate = useNavigate();
  const categories = getCategories();
  const [open, setOpen] = useState(() =>
    Object.fromEntries(categories.map((c) => [c, true]))
  );

  const toggle = (cat) => setOpen((p) => ({ ...p, [cat]: !p[cat] }));

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Tutorials</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        All available tutorials grouped by topic.
      </Typography>

      {categories.map((cat) => {
        const CatIcon = getCategoryIcon(cat);
        const subcategories = getSubcategories(cat);

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
              <CatIcon sx={{ color: 'primary.main', fontSize: 22 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>{cat}</Typography>
              <IconButton size="small" className="toggle-icon" sx={{ color: 'text.secondary' }}>
                {open[cat] ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Collapse in={open[cat]} timeout="auto">
              {subcategories.map((sub) => (
                <Box key={sub} sx={{ mb: 2 }}>
                  <Typography
                    variant="caption" color="text.secondary"
                    sx={{ pl: 1, textTransform: 'uppercase', letterSpacing: 1 }}
                  >
                    {sub}
                  </Typography>
                  <List dense sx={{ mt: 0.5 }}>
                    {tutorialRegistry
                      .filter((t) => t.category === cat && t.subcategory === sub)
                      .map((t, i) => {
                        const Icon = t.icon;
                        return (
                          <ListItemButton
                            key={t.id}
                            onClick={() => navigate(`/tutorials/${t.id}`)}
                            sx={{
                              borderRadius: 2, mb: 0.5, border: '1px solid', borderColor: 'divider',
                              transition: 'all 0.3s ease',
                              animation: `slideIn 0.3s ease ${i * 0.05}s both`,
                              '@keyframes slideIn': {
                                from: { opacity: 0, transform: 'translateX(-8px)' },
                                to: { opacity: 1, transform: 'translateX(0)' },
                              },
                              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                            }}
                          >
                            <ListItemIcon><Icon sx={{ color: 'primary.main' }} /></ListItemIcon>
                            <ListItemText
                              primary={t.title}
                              secondary={t.description}
                              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                              secondaryTypographyProps={{ fontSize: '0.8rem' }}
                            />
                            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
                              {t.tags.slice(0, 2).map((tag) => (
                                <Chip key={tag} label={tag} size="small" variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 22 }} />
                              ))}
                            </Box>
                          </ListItemButton>
                        );
                      })}
                  </List>
                </Box>
              ))}
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}
