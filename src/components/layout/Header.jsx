import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconButton, useMediaQuery, useTheme, Box, Button,
  InputBase, Paper, Typography, ClickAwayListener, Popper,
} from '@mui/material';
import {
  Menu, DarkMode, LightMode, Home, Dashboard, MenuBook,
  StickyNote2, Search, Close, Gavel,
} from '@mui/icons-material';
import useThemeMode from '../../hooks/useThemeMode';
import tutorialRegistry, { getCategoryIcon } from '../../features/tutorials/tutorialRegistry';

const NAV_LINKS = [
  { label: 'Home', path: '/home', icon: <Home fontSize="small" /> },
  { label: 'Dashboard', path: '/dashboard', icon: <Dashboard fontSize="small" /> },
  { label: 'Tutorials', path: '/tutorials', icon: <MenuBook fontSize="small" /> },
  { label: 'Notes', path: '/notes', icon: <StickyNote2 fontSize="small" /> },
  { label: 'License', path: '/license', icon: <Gavel fontSize="small" /> },
];

export default function Header({ onMenuClick }) {
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const anchorRef = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tutorialRegistry.filter((t) => {
      const haystack = [t.title, t.description, t.category, t.subcategory, ...t.tags]
        .join(' ').toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    }).slice(0, 8);
  }, [query]);

  useEffect(() => {
    setActiveIdx(-1);
    setOpen(results.length > 0);
  }, [results]);

  // close on route change
  useEffect(() => { setQuery(''); setOpen(false); }, [location.pathname]);

  // Ctrl+K to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = (id) => {
    navigate(`/tutorials/${id}`);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((p) => (p < results.length - 1 ? p + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((p) => (p > 0 ? p - 1 : results.length - 1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <Box
      sx={{
        zIndex: theme.zIndex.appBar,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        backdropFilter: 'blur(12px)',
        minHeight: { xs: 56, sm: 64 },
      }}
    >
      {isMobile && (
        <IconButton edge="start" onClick={onMenuClick} sx={{ mr: 0.5 }}>
          <Menu />
        </IconButton>
      )}

      {/* Nav links */}
      {!isMobile && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {NAV_LINKS.map(({ label, path, icon }) => {
            const isActive = location.pathname === path || (path !== '/home' && location.pathname.startsWith(path));
            return (
              <Button
                key={path}
                size="small"
                startIcon={icon}
                onClick={() => navigate(path)}
                sx={{
                  textTransform: 'none',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'primary.main' : 'text.secondary',
                  bgcolor: isActive ? 'action.hover' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {label}
              </Button>
            );
          })}
        </Box>
      )}

      {/* Search bar */}
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
          <Box
            ref={anchorRef}
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'action.hover',
              borderRadius: 2,
              px: 1.5,
              width: { xs: '100%', sm: 280 },
              transition: 'all 0.2s ease',
              border: '1px solid',
              borderColor: open ? 'primary.main' : 'transparent',
              '&:focus-within': { borderColor: 'primary.main', bgcolor: 'background.paper' },
            }}
          >
            <Search sx={{ fontSize: 20, color: 'text.disabled', mr: 1 }} />
            <InputBase
              inputRef={inputRef}
              placeholder={isMobile ? 'Search…' : 'Search tutorials… Ctrl+K'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              onKeyDown={handleKeyDown}
              sx={{ flex: 1, fontSize: '0.85rem', py: 0.6 }}
              inputProps={{ 'aria-label': 'search tutorials' }}
            />
            {query ? (
              <IconButton size="small" onClick={() => { setQuery(''); setOpen(false); }}>
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            ) : !isMobile && (
              <Typography variant="caption" sx={{
                px: 0.8, py: 0.2, borderRadius: 1, bgcolor: 'action.hover',
                color: 'text.disabled', fontSize: '0.65rem', whiteSpace: 'nowrap',
              }}>
                ⌘K
              </Typography>
            )}
          </Box>

          <Popper
            open={open}
            anchorEl={anchorRef.current}
            placement="bottom-end"
            style={{ zIndex: theme.zIndex.modal, width: anchorRef.current?.offsetWidth || 280 }}
          >
            <Paper
              elevation={8}
              sx={{
                mt: 0.5,
                borderRadius: 2,
                overflow: 'hidden',
                maxHeight: 400,
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {results.map((t, i) => {
                const CatIcon = getCategoryIcon(t.category);
                return (
                  <Box
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    onMouseEnter={() => setActiveIdx(i)}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      px: 2,
                      py: 1.2,
                      cursor: 'pointer',
                      bgcolor: i === activeIdx ? 'action.selected' : 'transparent',
                      transition: 'background 0.15s',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderBottom: i < results.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    <CatIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.3 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.84rem' }} noWrap>
                        {t.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {t.category} › {t.subcategory}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
              {results.length === 0 && query.trim() && (
                <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No tutorials found</Typography>
                </Box>
              )}
            </Paper>
          </Popper>
        </Box>
      </ClickAwayListener>

      {/* Theme toggle */}
      <IconButton
        onClick={toggleTheme}
        sx={{ transition: 'transform 0.3s ease', '&:hover': { transform: 'rotate(30deg)' } }}
      >
        {mode === 'dark' ? <LightMode sx={{ color: '#f0c36d' }} /> : <DarkMode sx={{ color: '#5c574f' }} />}
      </IconButton>
    </Box>
  );
}
