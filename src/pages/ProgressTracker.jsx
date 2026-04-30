import { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Container, Grid, Paper, Checkbox, FormControlLabel,
  LinearProgress, Chip, Button, Dialog, DialogTitle, DialogActions, Tooltip,
} from '@mui/material';
import {
  EmojiEvents, RestartAlt, CheckCircle, TrendingUp, CalendarToday,
} from '@mui/icons-material';

const STORAGE_KEY = 'archnorth-progress';

const WEEKS = [
  {
    week: 1, title: 'SQL Reactivation', emoji: '🗄️', color: '#4CAF50',
    tasks: [
      { id: 'w1-0', day: 'Mon', label: 'sql-basics — SELECT, WHERE, ORDER BY, LIMIT' },
      { id: 'w1-1', day: 'Tue', label: 'sql-joins — INNER, LEFT, RIGHT, FULL, self-join' },
      { id: 'w1-2', day: 'Wed', label: 'sql-aggregates — GROUP BY, COUNT, SUM, HAVING' },
      { id: 'w1-3', day: 'Thu', label: 'sql-subqueries-cte — Subqueries + WITH clause' },
      { id: 'w1-4', day: 'Fri', label: 'sql-window-functions — ROW_NUMBER, RANK, LAG, LEAD' },
      { id: 'w1-5', day: 'Sat', label: 'sql-indexing — Indexing & query optimization' },
      { id: 'w1-6', day: '🎯', label: 'LeetCode SQL 50 — first 12 problems done' },
    ],
  },
  {
    week: 2, title: 'Java Core Concepts', emoji: '☕', color: '#2196F3',
    tasks: [
      { id: 'w2-0', day: 'Mon', label: 'java-oop — OOP pillars + Java implementation' },
      { id: 'w2-1', day: 'Tue', label: 'java-equals-hashcode — equals(), hashCode(), ==, immutability' },
      { id: 'w2-2', day: 'Wed', label: 'java-hashmap — internals, buckets, load factor, Java 8' },
      { id: 'w2-3', day: 'Thu', label: 'java-collections-list — ArrayList vs LinkedList vs Vector' },
      { id: 'w2-4', day: 'Fri', label: 'java-strings — String pool, StringBuilder, StringBuffer' },
      { id: 'w2-5', day: 'Sat', label: 'java-exceptions — Checked vs unchecked, try-with-resources' },
    ],
  },
  {
    week: 3, title: 'Java Concurrency', emoji: '⚡', color: '#9C27B0',
    tasks: [
      { id: 'w3-0', day: 'Mon', label: 'java-thread-basics — Thread, Runnable, Callable, lifecycle' },
      { id: 'w3-1', day: 'Tue', label: 'java-executors — ExecutorService, thread pools, Future' },
      { id: 'w3-2', day: 'Wed', label: 'java-completablefuture — chaining, allOf, exception handling' },
      { id: 'w3-3', day: 'Thu', label: 'java-threadlocal — why, alternatives, pitfalls' },
      { id: 'w3-4', day: 'Fri', label: 'java-locks-atomics — synchronized, volatile, ReentrantLock' },
      { id: 'w3-5', day: 'Sat', label: 'java-concurrent-collections — ConcurrentHashMap, BlockingQueue' },
    ],
  },
  {
    week: 4, title: 'Spring Boot + Security', emoji: '🔐', color: '#FF9800',
    tasks: [
      { id: 'w4-0', day: 'Mon', label: 'spring-boot-fundamentals — auto-config, @SpringBootApplication' },
      { id: 'w4-1', day: 'Tue', label: 'spring-beans-di — Beans, scopes, lifecycle, DI' },
      { id: 'w4-2', day: 'Wed', label: 'spring-transactional — propagation, isolation, pitfalls' },
      { id: 'w4-3', day: 'Thu', label: 'spring-security-filter-chain — auth vs authorization' },
      { id: 'w4-4', day: 'Fri', label: 'spring-jwt-oauth2 — OAuth 2.0, JWT structure, JWKS validation' },
      { id: 'w4-5', day: 'Sat', label: 'auth0-migration-story — read full doc, run drills, fill in numbers' },
    ],
  },
  {
    week: 5, title: 'System Design — Foundations', emoji: '🏗️', color: '#F44336',
    tasks: [
      { id: 'w5-0', day: 'Mon', label: 'sd-scalability — vertical vs horizontal, stateless services' },
      { id: 'w5-1', day: 'Tue', label: 'sd-load-balancing — L4 vs L7, ALB, sticky sessions' },
      { id: 'w5-2', day: 'Wed', label: 'sd-caching — read/write-through, TTLs, Redis patterns' },
      { id: 'w5-3', day: 'Thu', label: 'sd-db-scaling — read replicas, sharding, partitioning' },
      { id: 'w5-4', day: 'Fri', label: 'sd-indexing — connect to ETL 40% improvement story' },
      { id: 'w5-5', day: 'Sat', label: 'sd-cap-consistency — eventual, strong, read-your-writes' },
    ],
  },
  {
    week: 6, title: 'System Design — Real Problems', emoji: '🎯', color: '#009688',
    tasks: [
      { id: 'w6-0', day: 'Mon', label: 'sd-url-shortener — 35-min timed design, talk out loud' },
      { id: 'w6-1', day: 'Tue', label: 'sd-rate-limiter — 35-min timed design' },
      { id: 'w6-2', day: 'Wed', label: 'sd-news-feed — 35-min timed design' },
      { id: 'w6-3', day: 'Thu', label: 'sd-chat-app — 35-min timed design' },
      { id: 'w6-4', day: 'Fri', label: 'sd-notification-service — 35-min timed design' },
      { id: 'w6-5', day: 'Sat', label: 'sd-flight-analytics — domain advantage design' },
    ],
  },
  {
    week: 7, title: 'DSA Bare Minimum', emoji: '🧠', color: '#607D8B',
    tasks: [
      { id: 'w7-0', day: 'Mon', label: 'dsa-two-pointers — Arrays + Two Pointers (1 easy + 1 medium)' },
      { id: 'w7-1', day: 'Tue', label: 'dsa-sliding-window — Sliding Window pattern' },
      { id: 'w7-2', day: 'Wed', label: 'dsa-hashmap — HashMap problems' },
      { id: 'w7-3', day: 'Thu', label: 'dsa-strings — String manipulation' },
      { id: 'w7-4', day: 'Fri', label: 'dsa-recursion — Recursion + basic backtracking' },
      { id: 'w7-5', day: 'Sat', label: 'dsa-bfs-dfs — BFS/DFS on Trees & Graphs' },
    ],
  },
  {
    week: 8, title: 'Mock Interviews + Docker/AWS', emoji: '🎤', color: '#795548',
    tasks: [
      { id: 'w8-0', day: 'Mon', label: 'Mock #1 — Coding round (Pramp / interviewing.io)' },
      { id: 'w8-1', day: 'Tue', label: 'Debrief Mock #1 + revise gaps' },
      { id: 'w8-2', day: 'Wed', label: 'Mock #2 — System design round' },
      { id: 'w8-3', day: 'Thu', label: 'Debrief Mock #2 + revise' },
      { id: 'w8-4', day: 'Fri', label: 'Mock #3 — Behavioral / leadership round' },
      { id: 'w8-5', day: 'Sat', label: 'docker-fundamentals + docker-spring-boot + AWS service stories' },
    ],
  },
];

const BEHAVIORAL = [
  { id: 'b-0', label: 'Auth0 migration — PingOne → Auth0, zero downtime, 10+ airlines', note: '📄 Full doc ready — just run the drills' },
  { id: 'b-1', label: 'Boeing IDEx Hackathon win — XGBoost / ML innovation' },
  { id: 'b-2', label: 'ETL 40% performance improvement — optimization deep dive' },
  { id: 'b-3', label: 'Cloud migration on-prem → Azure (large-scale change)' },
  { id: 'b-4', label: 'Mentored a junior developer' },
  { id: 'b-5', label: 'Disagreed with a manager or PM — conflict resolution' },
  { id: 'b-6', label: 'Used AI tools to ship something significant' },
  { id: 'b-7', label: 'Surviving the layoff — adapting in uncertainty' },
];

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
                <Chip
                  label={task.day}
                  size="small"
                  sx={{ height: 17, fontSize: '0.6rem', minWidth: 30, flexShrink: 0, bgcolor: 'action.selected' }}
                />
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
  const [progress, setProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  });
  const [resetOpen, setResetOpen] = useState(false);

  const toggle = useCallback((id) => {
    setProgress((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    const allIds = [...WEEKS.flatMap((w) => w.tasks.map((t) => t.id)), ...BEHAVIORAL.map((t) => t.id)];
    const done = allIds.filter((id) => progress[id]).length;
    const weeksComplete = WEEKS.filter((w) => w.tasks.every((t) => progress[t.id])).length;
    return {
      total: allIds.length,
      done,
      pct: Math.round((done / allIds.length) * 100),
      weeksComplete,
    };
  }, [progress]);

  const handleReset = () => {
    setProgress({});
    localStorage.removeItem(STORAGE_KEY);
    setResetOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>8-Week Interview Prep</Typography>
          <Typography variant="body2" color="text.secondary">
            30 min/day · 6 days/week · One topic at a time
          </Typography>
        </Box>
        <Tooltip title="Reset all progress">
          <Button
            startIcon={<RestartAlt />}
            onClick={() => setResetOpen(true)}
            color="error"
            size="small"
            variant="outlined"
          >
            Reset
          </Button>
        </Tooltip>
      </Box>

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
          <Chip icon={<EmojiEvents sx={{ fontSize: '0.9rem !important' }} />} label={`${stats.weeksComplete} / 8 weeks complete`} size="small" variant="outlined" />
          <Chip icon={<TrendingUp sx={{ fontSize: '0.9rem !important' }} />} label={`${8 - stats.weeksComplete} weeks remaining`} size="small" variant="outlined" />
          <Chip icon={<CalendarToday sx={{ fontSize: '0.9rem !important' }} />} label="30 min/day is the whole plan" size="small" variant="outlined" />
        </Box>
      </Paper>

      {/* Week cards */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Weekly Checklist</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {WEEKS.map((week) => (
          <Grid size={{ xs: 12, md: 6 }} key={week.week}>
            <WeekCard week={week} progress={progress} onToggle={toggle} />
          </Grid>
        ))}
      </Grid>

      {/* Behavioral Stories */}
      <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>Behavioral Stories</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Write 1 STAR-format story per Sunday. By Week 8 you'll have 8 ready.
      </Typography>
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}>
        {BEHAVIORAL.map((task) => (
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

      {/* Motivational rule */}
      <Paper elevation={0} sx={{
        p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider',
        bgcolor: 'action.hover', textAlign: 'center', mb: 4,
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          "If you miss a day, restart — don't rewind. Streak beats intensity."
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
