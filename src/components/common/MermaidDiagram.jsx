import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Box, IconButton, Modal, Tooltip, Typography, Slider, useMediaQuery, useTheme } from '@mui/material';
import {
  ZoomIn, ZoomOut, Fullscreen, Close, RestartAlt,
  FitScreen, Download,
} from '@mui/icons-material';
import useThemeMode from '../../hooks/useThemeMode';
import AppLoader from './AppLoader';

let mermaidId = 0;
let mermaidPromise = null;

const getMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, securityLevel: 'loose' });
      return m.default;
    });
  }
  return mermaidPromise;
};

// rootMargin only extends the observer's root, and the page content scrolls inside a
// container rather than the window, so observe relative to that container.
const getScrollParent = (el) => {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

const btnSx = {
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  '&:hover': { bgcolor: 'action.hover' },
};

const MermaidDiagram = memo(function MermaidDiagram({ chart }) {
  const ref = useRef(null);
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [svg, setSvg] = useState('');
  const [nearViewport, setNearViewport] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const placeholderRef = useRef(null);

  // Mermaid layout is main-thread heavy; only render diagrams the reader is about to see.
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || nearViewport) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearViewport(true); io.disconnect(); }
    }, { root: getScrollParent(el), rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [nearViewport]);

  useEffect(() => {
    if (!nearViewport) return;
    let cancelled = false;
    getMermaid().then((mermaid) => {
      if (cancelled) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: mode === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
      });
      const id = `mermaid-${++mermaidId}`;
      mermaid.render(id, chart).then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
    });
    return () => { cancelled = true; };
  }, [chart, mode, nearViewport]);

  const handleOpen = useCallback(() => {
    setZoom(isMobile ? 0.6 : 1);
    setPan({ x: 0, y: 0 });
    setOpen(true);
  }, [isMobile]);

  const handleClose = useCallback(() => setOpen(false), []);
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)), []);

  const handleReset = useCallback(() => {
    setZoom(isMobile ? 0.6 : 1);
    setPan({ x: 0, y: 0 });
  }, [isMobile]);

  const handleFit = useCallback(() => {
    setZoom(isMobile ? 0.35 : 0.5);
    setPan({ x: 0, y: 0 });
  }, [isMobile]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      return Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM);
    });
  }, []);

  const handlePointerDown = useCallback((e) => {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    setPan({ x: d.startPanX + (e.clientX - d.startX), y: d.startPanY + (e.clientY - d.startY) });
  }, []);

  const handlePointerUp = useCallback(() => { dragRef.current.dragging = false; }, []);

  const handleDownload = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [svg]);

  if (!svg) {
    return (
      <Box
        ref={placeholderRef}
        sx={{
          my: 3, minHeight: 160, borderRadius: 2, border: '1px dashed', borderColor: 'divider',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {failed ? (
          <Typography variant="body2" color="text.secondary">This diagram couldn&apos;t be drawn.</Typography>
        ) : nearViewport && <AppLoader variant="inline" label="Drawing diagram…" />}
      </Box>
    );
  }

  return (
    <>
      {/* Inline diagram */}
      <Box
        sx={{
          my: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2,
          border: '1px solid', borderColor: 'divider', overflow: 'auto',
          position: 'relative',
          '& svg': { maxWidth: '100%', height: 'auto' },
          '&:hover .expand-btn': { opacity: 1 },
        }}
      >
        <Box ref={ref} dangerouslySetInnerHTML={{ __html: svg }} />
        <Tooltip title="Expand diagram" placement="left">
          <IconButton
            className="expand-btn"
            onClick={handleOpen}
            size="small"
            sx={{
              position: 'absolute', top: 8, right: 8,
              opacity: { xs: 0.8, sm: 0 },
              transition: 'opacity 0.2s', ...btnSx,
            }}
          >
            <Fullscreen fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Fullscreen modal */}
      <Modal open={open} onClose={handleClose}>
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>

          {/* Top bar — title + close (always visible) */}
          <Box sx={{
            display: 'flex', alignItems: 'center', px: 1.5, py: 0.75,
            borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
            flexShrink: 0, minHeight: 48,
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              Diagram Viewer
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <IconButton onClick={handleClose} size="small" sx={{ ...btnSx, ml: 0.5 }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Diagram canvas */}
          <Box
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            sx={{
              flex: 1, overflow: 'hidden',
              cursor: dragRef.current.dragging ? 'grabbing' : 'grab',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              userSelect: 'none', touchAction: 'none',
            }}
          >
            <Box
              dangerouslySetInnerHTML={{ __html: svg }}
              sx={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: dragRef.current.dragging ? 'none' : 'transform 0.15s ease',
                '& svg': { maxWidth: 'none', height: 'auto' },
              }}
            />
          </Box>

          {/* Bottom toolbar — wraps nicely on mobile */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 }, px: 1.5, py: 1,
            borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
            flexShrink: 0,
          }}>
            <IconButton size="small" onClick={handleZoomOut} sx={btnSx}><ZoomOut fontSize="small" /></IconButton>

            <Box sx={{ width: { xs: 80, sm: 120 } }}>
              <Slider
                size="small"
                value={zoom}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                onChange={(_, v) => setZoom(v)}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
              />
            </Box>

            <IconButton size="small" onClick={handleZoomIn} sx={btnSx}><ZoomIn fontSize="small" /></IconButton>

            <Box sx={{ width: 1, height: 20, bgcolor: 'divider', display: { xs: 'none', sm: 'block' } }} />

            <IconButton size="small" onClick={handleFit} sx={btnSx}><FitScreen fontSize="small" /></IconButton>
            <IconButton size="small" onClick={handleReset} sx={btnSx}><RestartAlt fontSize="small" /></IconButton>
            <IconButton size="small" onClick={handleDownload} sx={btnSx}><Download fontSize="small" /></IconButton>
          </Box>

          {/* Hint */}
          <Box sx={{ textAlign: 'center', pb: 0.75, bgcolor: 'background.paper' }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              {isMobile ? 'Pinch to zoom • Drag to pan' : 'Scroll to zoom • Drag to pan • Esc to close'}
            </Typography>
          </Box>
        </Box>
      </Modal>
    </>
  );
});

export default MermaidDiagram;
