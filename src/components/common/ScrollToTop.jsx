import { useState, useEffect, useCallback, useRef } from 'react';
import { Fab, Zoom, Box } from '@mui/material';
import { KeyboardArrowUp } from '@mui/icons-material';

export default function ScrollToTop({ scrollRef }) {
  const [show, setShow] = useState(false);
  const progressRef = useRef(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShow(scrollTop > 300);
    const max = scrollHeight - clientHeight;
    const pct = max > 0 ? (scrollTop / max) * 100 : 0;
    if (progressRef.current) {
      progressRef.current.style.width = `${pct}%`;
    }
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef, handleScroll]);

  const scrollToTop = () => {
    scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Progress bar — pinned to top of wrapper */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 10,
          bgcolor: 'divider',
          pointerEvents: 'none',
        }}
      >
        <Box
          ref={progressRef}
          sx={{
            height: '100%',
            width: 0,
            bgcolor: 'primary.main',
            transition: 'none',
          }}
        />
      </Box>

      {/* FAB — pinned to bottom-right of wrapper */}
      <Zoom in={show}>
        <Fab
          size="small"
          color="primary"
          onClick={scrollToTop}
          aria-label="scroll to top"
          sx={{
            position: 'absolute',
            bottom: { xs: 16, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 10,
          }}
        >
          <KeyboardArrowUp />
        </Fab>
      </Zoom>
    </>
  );
}
