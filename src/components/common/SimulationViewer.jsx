import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Box, IconButton, Typography, Chip, Tooltip, LinearProgress, useTheme } from '@mui/material';
import {
  PlayArrow, Pause, SkipNext, SkipPrevious, Replay,
  Remove, Add,
} from '@mui/icons-material';

const NODE_W = 114;
const NODE_H = 48;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const palette = {
  idle: { fill: '#78909c', bg: 'rgba(120,144,156,0.10)' },
  active: { fill: '#43a047', bg: 'rgba(67,160,71,0.13)' },
  warn: { fill: '#ef6c00', bg: 'rgba(239,108,0,0.12)' },
  error: { fill: '#e53935', bg: 'rgba(229,57,53,0.12)' },
  highlight: { fill: '#1e88e5', bg: 'rgba(30,136,229,0.14)' },
};

/* ── SVG sub-components ── */

function GridPattern({ w, h, dark }) {
  const c = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  return (
    <>
      <defs>
        <pattern id="simGrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke={c} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#simGrid)" />
    </>
  );
}

function ArrowDef() {
  return (
    <defs>
      <marker id="arrowActive" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#1e88e5" />
      </marker>
      <marker id="arrowIdle" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="7" markerHeight="5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#78909c" opacity="0.5" />
      </marker>
    </defs>
  );
}

function Node({ x, y, label, status = 'idle', icon }) {
  const p = palette[status] || palette.idle;
  const isLive = status === 'active' || status === 'highlight';
  return (
    <g transform={`translate(${x},${y})`}>
      {/* glow */}
      {isLive && <rect x={-NODE_W / 2 - 3} y={-NODE_H / 2 - 3} width={NODE_W + 6} height={NODE_H + 6} rx={11} fill={p.fill} opacity={0.18}>
        <animate attributeName="opacity" values="0.18;0.30;0.18" dur="1.4s" repeatCount="indefinite" />
      </rect>}
      {/* body */}
      <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx={8}
        fill={p.bg} stroke={p.fill} strokeWidth={isLive ? 2 : 1.2} />
      {/* icon */}
      {icon && <text x={-NODE_W / 2 + 12} y={-2} fontSize={15} textAnchor="middle">{icon}</text>}
      {/* label */}
      <text x={icon ? 6 : 0} y={4} textAnchor="middle" fontSize={10.5} fontWeight={600}
        fill={p.fill} fontFamily="system-ui, sans-serif">{label}</text>
    </g>
  );
}

function Connection({ x1, y1, x2, y2, active }) {
  // shorten line so arrow doesn't overlap node
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const pad = NODE_W / 2 + 4;
  const ux = dx / len, uy = dy / len;
  const sx = x1 + ux * pad, sy = y1 + uy * pad;
  const ex = x2 - ux * pad, ey = y2 - uy * pad;
  return (
    <line x1={sx} y1={sy} x2={ex} y2={ey}
      stroke={active ? '#1e88e5' : '#78909c'}
      strokeWidth={active ? 2 : 1}
      strokeDasharray={active ? 'none' : '5 4'}
      opacity={active ? 0.85 : 0.25}
      markerEnd={active ? 'url(#arrowActive)' : 'url(#arrowIdle)'} />
  );
}

function Packet({ x1, y1, x2, y2, progress, color = '#1e88e5', label }) {
  const cx = x1 + (x2 - x1) * progress;
  const cy = y1 + (y2 - y1) * progress;
  // trail dots
  const trail = [0.06, 0.12, 0.18].map(offset => {
    const tp = Math.max(0, progress - offset);
    return { x: x1 + (x2 - x1) * tp, y: y1 + (y2 - y1) * tp, o: 1 - offset * 5 };
  });
  return (
    <g>
      {trail.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={3} fill={color} opacity={t.o * 0.3} />
      ))}
      <circle cx={cx} cy={cy} r={7} fill={color} opacity={0.9}>
        <animate attributeName="r" values="6;8;6" dur="0.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={3.5} fill="#fff" opacity={0.9} />
      {label && (
        <g transform={`translate(${cx},${cy - 16})`}>
          <rect x={-label.length * 3.2 - 4} y={-9} width={label.length * 6.4 + 8} height={16} rx={4}
            fill={color} opacity={0.88} />
          <text x={0} y={3} textAnchor="middle" fontSize={8.5} fontWeight={700}
            fill="#fff" fontFamily="system-ui, sans-serif">{label}</text>
        </g>
      )}
    </g>
  );
}

/* ── Main component ── */

const SimulationViewer = memo(function SimulationViewer({ config }) {
  const { title, description, nodes, connections, steps, width = 600, height = 320 } = config;
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [stepIdx, setStepIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [packetProgress, setPacketProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0); // default 0.5x
  const intervalRef = useRef(null);
  const packetRef = useRef(null);

  const speed = SPEEDS[speedIdx];
  const currentStep = stepIdx >= 0 && stepIdx < steps.length ? steps[stepIdx] : null;
  const atEnd = stepIdx >= steps.length - 1;
  const atStart = stepIdx <= 0;

  const goToStep = useCallback((idx) => {
    setStepIdx(idx);
    setPacketProgress(0);
  }, []);

  const advanceStep = useCallback(() => {
    setStepIdx(prev => {
      if (prev >= steps.length - 1) { setPlaying(false); return prev; }
      return prev + 1;
    });
    setPacketProgress(0);
  }, [steps.length]);

  // Auto-play
  useEffect(() => {
    if (playing && currentStep) {
      const dur = (currentStep.duration || 1500) / speed;
      intervalRef.current = setTimeout(advanceStep, dur);
    }
    return () => clearTimeout(intervalRef.current);
  }, [playing, stepIdx, advanceStep, currentStep, speed]);

  // Animate packet
  useEffect(() => {
    if (!currentStep?.packet) { setPacketProgress(0); return; }
    setPacketProgress(0);
    let start = null;
    const dur = ((currentStep.duration || 1500) * 0.7) / speed;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setPacketProgress(p);
      if (p < 1) packetRef.current = requestAnimationFrame(animate);
    };
    packetRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(packetRef.current);
  }, [stepIdx, currentStep, speed]);

  const handlePlay = () => {
    if (atEnd) goToStep(0);
    setPlaying(true);
    if (stepIdx < 0) goToStep(0);
  };
  const handlePause = () => setPlaying(false);
  const handleReset = () => { setPlaying(false); goToStep(-1); };
  const handleNext = () => { setPlaying(false); if (stepIdx < 0) goToStep(0); else if (!atEnd) goToStep(stepIdx + 1); };
  const handlePrev = () => { setPlaying(false); if (stepIdx > 0) goToStep(stepIdx - 1); };
  const handleSlower = () => setSpeedIdx(i => Math.max(0, i - 1));
  const handleFaster = () => setSpeedIdx(i => Math.min(SPEEDS.length - 1, i + 1));

  const nodeStatus = {};
  if (currentStep?.nodeStates) Object.entries(currentStep.nodeStates).forEach(([id, st]) => { nodeStatus[id] = st; });
  const activeConns = new Set(currentStep?.activeConnections || []);

  return (
    <Box sx={{
      my: 3, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
      bgcolor: 'background.paper', overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.2, borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', gap: 1,
        background: dark ? 'linear-gradient(90deg, rgba(30,136,229,0.08), transparent)' : 'linear-gradient(90deg, rgba(30,136,229,0.05), transparent)',
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: playing ? '#43a047' : '#78909c', flexShrink: 0 }}>
          {playing && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#43a047', animation: 'pulse 1.2s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, fontSize: { xs: '0.78rem', sm: '0.85rem' } }}>
          {title}
        </Typography>
        <Chip
          label={stepIdx < 0 ? 'Ready' : `${stepIdx + 1} / ${steps.length}`}
          size="small" variant="outlined"
          sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
        />
      </Box>

      {/* SVG Canvas */}
      <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', bgcolor: dark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: 380, maxHeight: 340, display: 'block' }}>
          <GridPattern w={width} h={height} dark={dark} />
          <ArrowDef />

          {/* Connections */}
          {connections.map((c, i) => {
            const from = nodes.find(n => n.id === c.from);
            const to = nodes.find(n => n.id === c.to);
            if (!from || !to) return null;
            return <Connection key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} active={activeConns.has(c.id)} />;
          })}

          {/* Packet */}
          {currentStep?.packet && (() => {
            const from = nodes.find(n => n.id === currentStep.packet.from);
            const to = nodes.find(n => n.id === currentStep.packet.to);
            if (!from || !to) return null;
            return <Packet x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              progress={packetProgress} color={currentStep.packet.color} label={currentStep.packet.label} />;
          })()}

          {/* Nodes */}
          {nodes.map(n => (
            <Node key={n.id} x={n.x} y={n.y} label={n.label} icon={n.icon}
              status={nodeStatus[n.id] || 'idle'} />
          ))}
        </svg>
      </Box>

      {/* Step description */}
      <Box sx={{
        px: 2, py: 1.2, minHeight: 44, borderTop: '1px solid', borderColor: 'divider',
        bgcolor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        display: 'flex', alignItems: 'center',
      }}>
        <Typography variant="body2" sx={{
          fontSize: { xs: '0.78rem', sm: '0.83rem' }, lineHeight: 1.5,
          color: currentStep ? 'text.primary' : 'text.disabled',
        }}>
          {currentStep?.description || description || 'Press ▶ to start the simulation'}
        </Typography>
      </Box>

      {/* Progress */}
      <LinearProgress
        variant="determinate"
        value={steps.length > 0 ? (Math.max(stepIdx + 1, 0) / steps.length) * 100 : 0}
        sx={{ height: 3, bgcolor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
      />

      {/* Controls */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: { xs: 0.25, sm: 0.5 }, py: 0.75, px: 1,
        borderTop: '1px solid', borderColor: 'divider',
      }}>
        <Tooltip title="Reset"><IconButton size="small" onClick={handleReset}><Replay fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Previous"><span><IconButton size="small" onClick={handlePrev} disabled={atStart && stepIdx <= 0}><SkipPrevious fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Slower"><span><IconButton size="small" onClick={handleSlower} disabled={speedIdx === 0}><Remove fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title={playing ? 'Pause' : 'Play'}>
          <IconButton onClick={playing ? handlePause : handlePlay} sx={{ bgcolor: 'primary.main', color: '#fff', width: 34, height: 34, '&:hover': { bgcolor: 'primary.dark' } }}>
            {playing ? <Pause sx={{ fontSize: 18 }} /> : <PlayArrow sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Faster"><span><IconButton size="small" onClick={handleFaster} disabled={speedIdx === SPEEDS.length - 1}><Add fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Next"><span><IconButton size="small" onClick={handleNext} disabled={atEnd}><SkipNext fontSize="small" /></IconButton></span></Tooltip>
        <Chip label={`${speed}x`} size="small" sx={{ fontSize: '0.68rem', height: 20, minWidth: 36, fontWeight: 700, bgcolor: speed !== 1 ? 'primary.main' : 'transparent', color: speed !== 1 ? '#fff' : 'text.secondary', border: '1px solid', borderColor: speed !== 1 ? 'primary.main' : 'divider' }} />
      </Box>
    </Box>
  );
});

export default SimulationViewer;
