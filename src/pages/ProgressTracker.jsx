import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Container, Grid, Paper, Checkbox, FormControlLabel,
  LinearProgress, Chip, Button, Dialog, DialogTitle, DialogActions, Tooltip, Alert,
} from '@mui/material';
import {
  EmojiEvents, RestartAlt, CheckCircle, TrendingUp, CalendarToday, FileUpload, FileDownload, Restore,
} from '@mui/icons-material';

const STORAGE_KEY = 'archnorth-progress';
const PLAN_KEY = 'archnorth-study-plan';

// A neutral plan built only from ArchNorth topics. A personal plan is imported from a JSON file
// and kept in this browser's storage only — it is never part of the public code.
const DEFAULT_PLAN = {
  version: 1,
  title: 'My Study Plan',
  subtitle: '30 min/day · 6 days/week · One topic at a time',
  weeks: [
    {
      week: 1, title: 'SQL', emoji: '🗄️', color: '#4CAF50',
      tasks: [
        { id: 'p1-0', day: 'Mon', label: 'sql-basics — SELECT, WHERE, ORDER BY, LIMIT' },
        { id: 'p1-1', day: 'Tue', label: 'sql-joins — INNER, LEFT, RIGHT, FULL, self-join' },
        { id: 'p1-2', day: 'Wed', label: 'sql-aggregates — GROUP BY, HAVING' },
        { id: 'p1-3', day: 'Thu', label: 'sql-subqueries-cte — subqueries and WITH' },
        { id: 'p1-4', day: 'Fri', label: 'sql-window-functions — ROW_NUMBER, RANK, LAG' },
        { id: 'p1-5', day: 'Sat', label: 'sql-indexing — indexes and query plans' },
      ],
    },
    {
      week: 2, title: 'Core Java', emoji: '☕', color: '#2196F3',
      tasks: [
        { id: 'p2-0', day: 'Mon', label: 'java-oop — the four pillars in practice' },
        { id: 'p2-1', day: 'Tue', label: 'java-equals-hashcode — equality and immutability' },
        { id: 'p2-2', day: 'Wed', label: 'hashmap-internals — buckets, resizing, Java 8 trees' },
        { id: 'p2-3', day: 'Thu', label: 'java-collections-list — List, Queue, Set' },
        { id: 'p2-4', day: 'Fri', label: 'java-strings — pool, StringBuilder' },
        { id: 'p2-5', day: 'Sat', label: 'java-exceptions — checked vs unchecked, try-with-resources' },
      ],
    },
    {
      week: 3, title: 'Concurrency & Modern Java', emoji: '⚡', color: '#9C27B0',
      tasks: [
        { id: 'p3-0', day: 'Mon', label: 'multithreading — threads, executors, locks' },
        { id: 'p3-1', day: 'Tue', label: 'concurrent-hashmap — how it stays thread-safe' },
        { id: 'p3-2', day: 'Wed', label: 'completable-future — composing async work' },
        { id: 'p3-3', day: 'Thu', label: 'java-memory-model — visibility and happens-before' },
        { id: 'p3-4', day: 'Fri', label: 'java8-features — streams, Optional, lambdas' },
        { id: 'p3-5', day: 'Sat', label: 'java17-features — records, sealed types, switch' },
      ],
    },
    {
      week: 4, title: 'Spring Boot & Security', emoji: '🔐', color: '#FF9800',
      tasks: [
        { id: 'p4-0', day: 'Mon', label: 'spring-boot-fundamentals — auto-configuration, profiles' },
        { id: 'p4-1', day: 'Tue', label: 'spring-beans-di — beans, scopes, proxies' },
        { id: 'p4-2', day: 'Wed', label: 'spring-transactional — propagation, isolation, pitfalls' },
        { id: 'p4-3', day: 'Thu', label: 'auth-security-decisions — where to authenticate and authorize' },
        { id: 'p4-4', day: 'Fri', label: 'auth0-deep-dive — OAuth2, OIDC, JWT validation' },
        { id: 'p4-5', day: 'Sat', label: 'journey-05-spring-boot — build the ShopNorth order service' },
      ],
    },
    {
      week: 5, title: 'System Design — Foundations', emoji: '🏗️', color: '#F44336',
      tasks: [
        { id: 'p5-0', day: 'Mon', label: 'thinking-system-design — the framework' },
        { id: 'p5-1', day: 'Tue', label: 'load-balancing — L4 vs L7, health checks' },
        { id: 'p5-2', day: 'Wed', label: 'cache-system + caching-strategy — patterns and invalidation' },
        { id: 'p5-3', day: 'Thu', label: 'database-decisions — replicas, sharding, partitioning' },
        { id: 'p5-4', day: 'Fri', label: 'cdn-deep-dive — edge caching' },
        { id: 'p5-5', day: 'Sat', label: 'messaging-decisions — queues and events' },
      ],
    },
    {
      week: 6, title: 'System Design — Practice', emoji: '🎯', color: '#009688',
      tasks: [
        { id: 'p6-0', day: 'Mon', label: 'url-shortener — 35-minute timed design, out loud' },
        { id: 'p6-1', day: 'Tue', label: 'rate-limiter — 35-minute timed design' },
        { id: 'p6-2', day: 'Wed', label: 'design-newsfeed — 35-minute timed design' },
        { id: 'p6-3', day: 'Thu', label: 'design-chat-system — 35-minute timed design' },
        { id: 'p6-4', day: 'Fri', label: 'notification-system — 35-minute timed design' },
        { id: 'p6-5', day: 'Sat', label: 'payment-gateway — 35-minute timed design' },
      ],
    },
    {
      week: 7, title: 'DSA Patterns', emoji: '🧠', color: '#607D8B',
      tasks: [
        { id: 'p7-0', day: 'Mon', label: 'dsa-two-pointers — 1 easy + 1 medium problem' },
        { id: 'p7-1', day: 'Tue', label: 'dsa-sliding-window — 1 easy + 1 medium problem' },
        { id: 'p7-2', day: 'Wed', label: 'dsa-strings — 2 problems' },
        { id: 'p7-3', day: 'Thu', label: 'dsa-recursion — recursion and backtracking' },
        { id: 'p7-4', day: 'Fri', label: 'dsa-bfs-dfs — trees and graphs' },
        { id: 'p7-5', day: 'Sat', label: 'Redo 3 practice questions you got wrong this week' },
      ],
    },
    {
      week: 8, title: 'Ship It', emoji: '🚀', color: '#795548',
      tasks: [
        { id: 'p8-0', day: 'Mon', label: 'docker-fundamentals + docker-spring-boot' },
        { id: 'p8-1', day: 'Tue', label: 'k8s-fundamentals + k8s-spring-boot' },
        { id: 'p8-2', day: 'Wed', label: 'journey-11-cicd — the pipeline end to end' },
        { id: 'p8-3', day: 'Thu', label: 'journey-13-observability — dashboards, SLOs, alerts' },
        { id: 'p8-4', day: 'Fri', label: 'journey-14-launch-day — incidents and postmortems' },
        { id: 'p8-5', day: 'Sat', label: 'Explain the ShopNorth journey end to end, out loud' },
      ],
    },
  ],
  stories: null,
  quote: 'If you miss a day, restart — don’t rewind. Streak beats intensity.',
};

const isTask = (t) => t && typeof t.id === 'string' && typeof t.label === 'string';

/** Returns a clean plan object, or null if the data isn't a valid plan. */
function normalizePlan(data) {
  if (!data || !Array.isArray(data.weeks) || data.weeks.length === 0) return null;
  const weeks = data.weeks.map((w, i) => ({
    week: Number(w.week) || i + 1,
    title: String(w.title || `Week ${i + 1}`),
    emoji: String(w.emoji || '📘'),
    color: /^#[0-9a-f]{3,8}$/i.test(w.color || '') ? w.color : '#4a7c6f',
    tasks: Array.isArray(w.tasks) ? w.tasks.filter(isTask).map((t) => ({ id: t.id, day: String(t.day || ''), label: t.label })) : [],
  })).filter((w) => w.tasks.length > 0);
  if (weeks.length === 0) return null;
  const items = Array.isArray(data.stories?.items) ? data.stories.items.filter(isTask) : [];
  return {
    version: 1,
    title: String(data.title || DEFAULT_PLAN.title),
    subtitle: String(data.subtitle || ''),
    weeks,
    stories: items.length ? { title: String(data.stories.title || 'Stories'), intro: String(data.stories.intro || ''), items } : null,
    quote: String(data.quote || DEFAULT_PLAN.quote),
  };
}

function loadPlan() {
  try {
    return normalizePlan(JSON.parse(localStorage.getItem(PLAN_KEY))) || DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

function WeekCard({ week, progress, onToggle }) {
  const done = week.tasks.filter((t) => progress[t.id]).length;
  const pct = Math.round((done / week.tasks.length) * 100);
  const isComplete = done === week.tasks.length;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5, height: '100%',
        border: '1px solid',
        borderColor: isComplete ? week.color : 'divider',
        borderLeft: `4px solid ${week.color}`,
        borderRadius: 3,
        transition: 'all 0.3s ease',
        opacity: isComplete ? 0.88 : 1,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{week.emoji}</Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Week {week.week}: {week.title}
          </Typography>
        </Box>
        <Chip
          label={`${done}/${week.tasks.length}`}
          size="small"
          sx={{
            bgcolor: isComplete ? week.color : 'action.hover',
            color: isComplete ? '#fff' : 'text.secondary',
            fontWeight: 700, fontSize: '0.7rem',
          }}
        />
      </Box>

      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 5, borderRadius: 3, mb: 1.5,
          bgcolor: 'action.disabledBackground',
          '& .MuiLinearProgress-bar': { bgcolor: week.color, borderRadius: 3 },
        }}
      />

      <Box>
        {week.tasks.map((task) => (
          <FormControlLabel
            key={task.id}
            control={
              <Checkbox
                size="small"
                checked={!!progress[task.id]}
                onChange={() => onToggle(task.id)}
                sx={{
                  color: week.color,
                  '&.Mui-checked': { color: week.color },
                  py: 0.25, px: 0.5,
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', minWidth: 0 }}>
                {task.day && (
                  <Chip
                    label={task.day}
                    size="small"
                    sx={{ height: 17, fontSize: '0.6rem', minWidth: 30, flexShrink: 0, bgcolor: 'action.selected' }}
                  />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    textDecoration: progress[task.id] ? 'line-through' : 'none',
                    color: progress[task.id] ? 'text.disabled' : 'text.primary',
                    fontSize: '0.79rem',
                    lineHeight: 1.4,
                  }}
                >
                  {task.label}
                </Typography>
              </Box>
            }
            sx={{ display: 'flex', width: '100%', mx: 0, mb: 0.25, alignItems: 'flex-start' }}
          />
        ))}
      </Box>
    </Paper>
  );
}

export default function ProgressTracker() {
  const [plan, setPlan] = useState(loadPlan);
  const [progress, setProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  });
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileRef = useRef(null);
  const isDefault = plan === DEFAULT_PLAN;

  const toggle = useCallback((id) => {
    setProgress((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    const allIds = [...plan.weeks.flatMap((w) => w.tasks.map((t) => t.id)), ...(plan.stories?.items || []).map((t) => t.id)];
    const done = allIds.filter((id) => progress[id]).length;
    const weeksComplete = plan.weeks.filter((w) => w.tasks.every((t) => progress[t.id])).length;
    return {
      total: allIds.length,
      done,
      pct: allIds.length ? Math.round((done / allIds.length) * 100) : 0,
      weeksComplete,
      weeks: plan.weeks.length,
    };
  }, [plan, progress]);

  const handleReset = () => {
    setProgress({});
    localStorage.removeItem(STORAGE_KEY);
    setResetOpen(false);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = normalizePlan(JSON.parse(await file.text()));
      if (!imported) throw new Error('not a plan');
      localStorage.setItem(PLAN_KEY, JSON.stringify(imported));
      setPlan(imported);
      setNotice({ severity: 'success', text: `Loaded “${imported.title}”. It's saved in this browser only.` });
    } catch {
      setNotice({ severity: 'error', text: 'That file isn’t a valid study plan (expected JSON with a "weeks" list).' });
    }
  };

  const handleExport = () => {
    const blob = new Blob([`${JSON.stringify(plan, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-study-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUseDefault = () => {
    localStorage.removeItem(PLAN_KEY);
    setPlan(DEFAULT_PLAN);
    setNotice({ severity: 'info', text: 'Switched to the default plan. Your imported plan was removed from this browser (export it first if you need a copy).' });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>{plan.title}</Typography>
          {plan.subtitle && (
            <Typography variant="body2" color="text.secondary">{plan.subtitle}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
          <Tooltip title="Load your own plan from a JSON file (kept in this browser only)">
            <Button startIcon={<FileUpload />} onClick={() => fileRef.current?.click()} size="small" variant="outlined">
              Import plan
            </Button>
          </Tooltip>
          <Tooltip title="Download the current plan as JSON">
            <Button startIcon={<FileDownload />} onClick={handleExport} size="small" variant="outlined">
              Export
            </Button>
          </Tooltip>
          {!isDefault && (
            <Tooltip title="Go back to the default ArchNorth plan">
              <Button startIcon={<Restore />} onClick={handleUseDefault} size="small" variant="outlined">
                Use default
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Reset all progress">
            <Button startIcon={<RestartAlt />} onClick={() => setResetOpen(true)} color="error" size="small" variant="outlined">
              Reset
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 3 }}>{notice.text}</Alert>
      )}

      {/* Overall progress */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Overall Progress</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>{stats.pct}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={stats.pct}
          sx={{ height: 10, borderRadius: 5, mb: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Chip icon={<CheckCircle sx={{ fontSize: '0.9rem !important' }} />} label={`${stats.done} / ${stats.total} tasks done`} size="small" color="primary" variant="outlined" />
          <Chip icon={<EmojiEvents sx={{ fontSize: '0.9rem !important' }} />} label={`${stats.weeksComplete} / ${stats.weeks} weeks complete`} size="small" variant="outlined" />
          <Chip icon={<TrendingUp sx={{ fontSize: '0.9rem !important' }} />} label={`${stats.weeks - stats.weeksComplete} weeks remaining`} size="small" variant="outlined" />
          <Chip icon={<CalendarToday sx={{ fontSize: '0.9rem !important' }} />} label="30 min/day is the whole plan" size="small" variant="outlined" />
        </Box>
      </Paper>

      {/* Week cards */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Weekly Checklist</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {plan.weeks.map((week) => (
          <Grid size={{ xs: 12, md: 6 }} key={week.week}>
            <WeekCard week={week} progress={progress} onToggle={toggle} />
          </Grid>
        ))}
      </Grid>

      {/* Optional stories section (only in imported plans) */}
      {plan.stories && (
        <>
          <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>{plan.stories.title}</Typography>
          {plan.stories.intro && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{plan.stories.intro}</Typography>
          )}
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}>
            {plan.stories.items.map((task) => (
              <Box key={task.id} sx={{ mb: task.note ? 0.5 : 0 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!progress[task.id]}
                      onChange={() => toggle(task.id)}
                      sx={{ color: 'primary.main', '&.Mui-checked': { color: 'primary.main' }, py: 0.5 }}
                    />
                  }
                  label={
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          textDecoration: progress[task.id] ? 'line-through' : 'none',
                          color: progress[task.id] ? 'text.disabled' : 'text.primary',
                        }}
                      >
                        {task.label}
                      </Typography>
                      {task.note && (
                        <Typography variant="caption" color="primary.main">{task.note}</Typography>
                      )}
                    </Box>
                  }
                  sx={{ display: 'flex', mb: 0.5 }}
                />
              </Box>
            ))}
          </Paper>
        </>
      )}

      {/* Motivational rule */}
      <Paper elevation={0} sx={{
        p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider',
        bgcolor: 'action.hover', textAlign: 'center', mb: 4,
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          “{plan.quote}”
        </Typography>
      </Paper>

      {/* Reset dialog */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Reset all progress?</DialogTitle>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button onClick={handleReset} color="error" variant="contained">Reset</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
