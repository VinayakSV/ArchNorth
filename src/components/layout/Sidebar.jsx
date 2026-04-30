import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Box, useMediaQuery, useTheme, Divider,
  Collapse,
} from '@mui/material';
import {
  Dashboard, MenuBook, StickyNote2, Home, Gavel,
  ExpandLess, ExpandMore, Circle,
} from '@mui/icons-material';
import tutorialRegistry, {
  getCategories, getSubcategories, getCategoryIcon, getTutorialById,
} from '../../features/tutorials/tutorialRegistry';

// Pre-compute tutorial tree once at module level
const TREE = getCategories().map((cat) => ({
  cat,
  Icon: getCategoryIcon(cat),
  subs: getSubcategories(cat).map((sub) => ({
    sub,
    key: `${cat}::${sub}`,
    tutorials: tutorialRegistry.filter((t) => t.category === cat && t.subcategory === sub),
  })),
}));

const DRAWER_WIDTH = 260;

const navItemSx = (isActive) => ({
  borderRadius: 2,
  mb: 0.5,
  transition: 'all 0.2s ease',
  '&.Mui-selected': {
    bgcolor: 'primary.main',
    color: '#fff',
    '& .MuiListItemIcon-root': { color: '#fff' },
    '&:hover': { bgcolor: 'primary.dark' },
  },
  ...(!isActive && { '&:hover': { bgcolor: 'action.hover' } }),
});

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [tutorialsOpen, setTutorialsOpen] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const [openSubs, setOpenSubs] = useState({});

  // Auto-expand sidebar tree to match current route
  useEffect(() => {
    if (location.pathname.startsWith('/tutorials')) {
      setTutorialsOpen(true);
    }
    const match = location.pathname.match(/^\/tutorials\/(.+)/);
    if (!match) return;
    const tutorial = getTutorialById(match[1]);
    if (!tutorial) return;
    setOpenCats((p) => ({ ...p, [tutorial.category]: true }));
    setOpenSubs((p) => ({ ...p, [`${tutorial.category}::${tutorial.subcategory}`]: true }));
  }, [location.pathname]);

  const toggleCat = useCallback((cat) =>
    setOpenCats((p) => ({ ...p, [cat]: !p[cat] })), []);
  const toggleSub = useCallback((key) =>
    setOpenSubs((p) => ({ ...p, [key]: !p[key] })), []);

  const handleNav = (path) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const isPathActive = (path) =>
    location.pathname === path ||
    (path !== '/home' && location.pathname.startsWith(path));

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        sx={{ px: 2, gap: 1, cursor: 'pointer', flexShrink: 0 }}
        onClick={() => handleNav('/')}
      >
        <MenuBook sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: 'primary.main' }}>
          ArchNorth
        </Typography>
      </Toolbar>
      <Divider />

      <Box sx={{ flex: 1, overflow: 'auto', px: 1, pt: 1 }}>
        <List disablePadding>
          {/* Home */}
          <ListItemButton
            selected={isPathActive('/home')}
            onClick={() => handleNav('/home')}
            sx={navItemSx(isPathActive('/home'))}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Home /></ListItemIcon>
            <ListItemText primary="Home" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
          </ListItemButton>

          {/* Dashboard */}
          <ListItemButton
            selected={isPathActive('/dashboard')}
            onClick={() => handleNav('/dashboard')}
            sx={navItemSx(isPathActive('/dashboard'))}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Dashboard /></ListItemIcon>
            <ListItemText primary="Dashboard" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
          </ListItemButton>

          {/* Tutorials — collapsible parent */}
          <ListItemButton
            onClick={() => setTutorialsOpen((p) => !p)}
            sx={{
              borderRadius: 2, mb: 0.5,
              bgcolor: location.pathname.startsWith('/tutorials') ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><MenuBook /></ListItemIcon>
            <ListItemText primary="Tutorials" primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }} />
            {tutorialsOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </ListItemButton>

          <Collapse in={tutorialsOpen} timeout="auto" unmountOnExit>
            <List disablePadding sx={{ pl: 1 }}>
              <ListItemButton
                selected={location.pathname === '/tutorials'}
                onClick={() => handleNav('/tutorials')}
                sx={{ borderRadius: 2, mb: 0.3, py: 0.4 }}
              >
                <ListItemText
                  primary="All Tutorials"
                  primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary' }}
                />
              </ListItemButton>

              {TREE.map(({ cat, Icon: CatIcon, subs }) => {
                const catOpen = !!openCats[cat];
                return (
                  <Box key={cat}>
                    <ListItemButton
                      onClick={() => toggleCat(cat)}
                      sx={{ borderRadius: 2, mb: 0.3, py: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <CatIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={cat}
                        primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600 }}
                      />
                      {catOpen ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                    </ListItemButton>

                    <Collapse in={catOpen} timeout="auto" unmountOnExit>
                      <List disablePadding sx={{ pl: 1.5 }}>
                        {subs.map(({ sub, key: subKey, tutorials }) => {
                          const subOpen = !!openSubs[subKey];
                          return (
                            <Box key={subKey}>
                              <ListItemButton
                                onClick={() => toggleSub(subKey)}
                                sx={{ borderRadius: 2, mb: 0.2, py: 0.3 }}
                              >
                                <ListItemText
                                  primary={sub}
                                  primaryTypographyProps={{
                                    fontSize: '0.75rem', fontWeight: 500,
                                    color: 'text.secondary', textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                  }}
                                />
                                {subOpen
                                  ? <ExpandLess sx={{ fontSize: 14, color: 'text.disabled' }} />
                                  : <ExpandMore sx={{ fontSize: 14, color: 'text.disabled' }} />}
                              </ListItemButton>

                              <Collapse in={subOpen} timeout="auto" unmountOnExit>
                                <List disablePadding sx={{ pl: 1 }}>
                                  {tutorials.map((t) => {
                                    const active = location.pathname === `/tutorials/${t.id}`;
                                    return (
                                      <ListItemButton
                                        key={t.id}
                                        selected={active}
                                        onClick={() => handleNav(`/tutorials/${t.id}`)}
                                        sx={{
                                          borderRadius: 1.5, mb: 0.2, py: 0.3, minHeight: 32,
                                          '&.Mui-selected': {
                                            bgcolor: 'primary.main', color: '#fff',
                                            '& .MuiListItemIcon-root': { color: '#fff' },
                                            '&:hover': { bgcolor: 'primary.dark' },
                                          },
                                        }}
                                      >
                                        <ListItemIcon sx={{ minWidth: 20 }}>
                                          <Circle sx={{ fontSize: 5, color: active ? '#fff' : 'text.disabled' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                          primary={t.title}
                                          primaryTypographyProps={{ fontSize: '0.78rem', fontWeight: active ? 600 : 400 }}
                                        />
                                      </ListItemButton>
                                    );
                                  })}
                                </List>
                              </Collapse>
                            </Box>
                          );
                        })}
                      </List>
                    </Collapse>
                  </Box>
                );
              })}
            </List>
          </Collapse>

          {/* Notes */}
          <ListItemButton
            selected={isPathActive('/notes')}
            onClick={() => handleNav('/notes')}
            sx={navItemSx(isPathActive('/notes'))}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><StickyNote2 /></ListItemIcon>
            <ListItemText primary="Notes" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
          </ListItemButton>

          {/* License */}
          <ListItemButton
            selected={isPathActive('/license')}
            onClick={() => handleNav('/license')}
            sx={navItemSx(isPathActive('/license'))}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Gavel /></ListItemIcon>
            <ListItemText primary="License" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
          </ListItemButton>
        </List>
      </Box>

      <Divider />
      <Box sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">v2.0.0</Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? open : true}
      onClose={onClose}
      sx={{
        width: isMobile ? 0 : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {content}
    </Drawer>
  );
}
