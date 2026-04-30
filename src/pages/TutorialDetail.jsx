import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Box, Typography, IconButton, Chip, CircularProgress, TextField, Button,
  Collapse, Paper, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import {
  ArrowBack, NoteAdd, Delete, Save, AccessTime,
  ArrowBackIos, ArrowForwardIos, FileDownload, School,
  Close, KeyboardArrowLeft, KeyboardArrowRight, Flip,
} from '@mui/icons-material';
import MarkdownViewer from '../components/common/MarkdownViewer';
import InterviewPanel from '../components/common/InterviewPanel';
import SimulationViewer from '../components/common/SimulationViewer';
import { simulationMap } from '../components/common/simulations/simulationConfigs';
import { getTutorialById, getAdjacentTutorials } from '../features/tutorials/tutorialRegistry';

// Build lookup map once at module level
const mdModules = import.meta.glob('../content/**/*.md', { query: '?raw', import: 'default' });
const mdKeysByFolder = {};
for (const key of Object.keys(mdModules)) {
  const parts = key.split('/');
  const folder = parts[parts.length - 2];
  if (!mdKeysByFolder[folder]) mdKeysByFolder[folder] = [];
  mdKeysByFolder[folder].push(key);
}

const mdCache = {};

const NOTES_KEY = 'archnorth-notes-by-tutorial';

function extractInterviewBlocks(content) {
  if (!content) return [];
  const blocks = [];
  const regex = /<div\s+class="callout-interview">\s*\n([\s\S]*?)\n\s*<\/div>/g;
  let match;
  while ((match = regex.exec(content)) !== null) blocks.push(match[1].trim());
  return blocks;
}

function FlashcardMode({ blocks, tutorialTitle, onClose }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [doneSet, setDoneSet] = useState(new Set());

  const questions = blocks.map((b) => {
    const m = b.match(/\*\*Q:\s*"([^"]+)"\*\*/);
    return m ? m[1] : `Question ${blocks.indexOf(b) + 1}`;
  });

  const total = blocks.length;
  const pct = Math.round((doneSet.size / total) * 100);

  const goNext = () => { setFlipped(false); setIdx((i) => Math.min(i + 1, total - 1)); };
  const goPrev = () => { setFlipped(false); setIdx((i) => Math.max(i - 1, 0)); };
  const toggleDone = () => setDoneSet((s) => {
    const n = new Set(s);
    n.has(idx) ? n.delete(idx) : n.add(idx);
    return n;
  });

  return (
    <Box sx={{
      position: 'fixed', inset: 0, bgcolor: 'background.default', zIndex: 1400,
      display: 'flex', flexDirection: 'column', alignItems: 'center', p: { xs: 2, md: 4 },
    }}>
      {/* Top bar */}
      <Box sx={{ width: '100%', maxWidth: 720, display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <School sx={{ color: 'primary.main' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Flashcard Mode — {tutorialTitle}</Typography>
          <Typography variant="caption" color="text.secondary">{doneSet.size}/{total} marked as done</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ width: '100%', maxWidth: 720, mb: 3, height: 6, borderRadius: 3 }} />

      {/* Card */}
      <Box sx={{
        width: '100%', maxWidth: 720, flex: 1, display: 'flex', flexDirection: 'column',
        border: '1px solid', borderColor: doneSet.has(idx) ? 'success.main' : 'divider',
        borderRadius: 4, bgcolor: 'background.paper', p: { xs: 2.5, md: 4 },
        cursor: 'pointer', transition: 'all 0.3s ease', mb: 3,
        '&:hover': { borderColor: 'primary.main' },
      }} onClick={() => setFlipped((f) => !f)}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Chip label={`Q${idx + 1} of ${total}`} size="small" color="primary" />
          <Chip
            icon={<Flip sx={{ fontSize: '0.8rem !important' }} />}
            label={flipped ? 'Showing answer' : 'Tap to reveal'}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, lineHeight: 1.5 }}>
          {questions[idx]}
        </Typography>
        {flipped && (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, mt: 'auto' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>Answer</Typography>
            <Box sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.primary', whiteSpace: 'pre-wrap' }}>
              {blocks[idx].replace(/\*\*Q:\s*"[^"]+"\*\*\n?/, '').replace(/\*\*/g, '').trim()}
            </Box>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', maxWidth: 720 }}>
        <IconButton onClick={goPrev} disabled={idx === 0}><KeyboardArrowLeft /></IconButton>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button
            variant={doneSet.has(idx) ? 'contained' : 'outlined'}
            color={doneSet.has(idx) ? 'success' : 'inherit'}
            size="small"
            onClick={toggleDone}
          >
            {doneSet.has(idx) ? 'Got it ✓' : 'Mark as done'}
          </Button>
          <Button variant="outlined" size="small" onClick={() => setFlipped((f) => !f)}>
            {flipped ? 'Hide answer' : 'Reveal'}
          </Button>
        </Box>
        <IconButton onClick={goNext} disabled={idx === total - 1}><KeyboardArrowRight /></IconButton>
      </Box>
    </Box>
  );
}

const loadTutorialNotes = (tutorialId) => {
  try {
    return (JSON.parse(localStorage.getItem(NOTES_KEY)) || {})[tutorialId] || [];
  } catch { return []; }
};

const saveTutorialNotes = (tutorialId, notes) => {
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY)) || {};
    all[tutorialId] = notes;
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

function findMdKey(id, fileHint) {
  const keys = mdKeysByFolder[id] || [];
  if (fileHint) {
    const clean = fileHint.replace('./', '').replace('.md', '');
    return keys.find((k) => k.includes(clean));
  }
  return keys.find((k) => k.includes(`/${id}.md`) || k.includes(`/${id}/`)) || keys[0];
}

const getReadingTime = (text) => {
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} min read`;
};

export default function TutorialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [subPage, setSubPage] = useState(null);
  const [flashcardOpen, setFlashcardOpen] = useState(false);

  const interviewBlocks = useMemo(() => extractInterviewBlocks(content), [content]);

  const tutorial = getTutorialById(id);
  const { prev, next } = useMemo(() => getAdjacentTutorials(id), [id]);

  const exportNotesAsMd = useCallback(() => {
    if (notes.length === 0) return;
    const md = `# Notes: ${tutorial?.title || id}\n_Exported from ArchNorth on ${new Date().toLocaleDateString()}_\n\n---\n\n` +
      notes.map((n) => `- ${n.text}\n  _(${new Date(n.createdAt).toLocaleDateString()})_`).join('\n\n');
    const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes, tutorial, id]);
  const loadIdRef = useRef(0);

  const readingTime = useMemo(() => content ? getReadingTime(content) : '', [content]);

  const loadMd = useCallback((fileHint) => {
    const thisLoad = ++loadIdRef.current;
    const key = findMdKey(id, fileHint);

    if (!key) {
      setContent('# 🚧 Coming Soon\n\nThis tutorial is under construction. Check back soon!');
      setLoading(false);
      return;
    }

    if (mdCache[key]) {
      setContent(mdCache[key]);
      setLoading(false);
      return;
    }

    setLoading(true);
    mdModules[key]()
      .then((md) => {
        if (thisLoad !== loadIdRef.current) return;
        mdCache[key] = md;
        setContent(md);
        setLoading(false);
      })
      .catch(() => {
        if (thisLoad !== loadIdRef.current) return;
        setContent('# 🚧 Coming Soon\n\nThis tutorial is under construction. Check back soon!');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    setSubPage(null);
    loadMd(null);
    setNotes(loadTutorialNotes(id));
  }, [id, loadMd]);

  const handleSubNavigate = useCallback((href) => {
    setSubPage(href.replace('./', '').replace('.md', ''));
    loadMd(href);
  }, [loadMd]);

  const handleBackToMain = useCallback(() => {
    setSubPage(null);
    loadMd(null);
  }, [loadMd]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const updated = [{ id: Date.now(), text: newNote, createdAt: new Date().toISOString() }, ...notes];
    setNotes(updated);
    saveTutorialNotes(id, updated);
    setNewNote('');
  };

  const handleDeleteNote = (noteId) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    saveTutorialNotes(id, updated);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => subPage ? handleBackToMain() : navigate(-1)} size="small">
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1, minWidth: 0, fontSize: { xs: '1.2rem', sm: '1.5rem' } }} noWrap>
            {tutorial?.title || id}
          </Typography>
          {!loading && !subPage && interviewBlocks.length > 0 && (
            <Tooltip title={`Flashcard mode (${interviewBlocks.length} questions)`}>
              <IconButton
                size="small"
                onClick={() => setFlashcardOpen(true)}
                sx={{
                  border: '1px solid', borderColor: 'divider',
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', color: 'primary.main' },
                }}
              >
                <School fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            size="small"
            onClick={() => setNotesOpen(!notesOpen)}
            sx={{
              border: '1px solid', borderColor: notesOpen ? 'primary.main' : 'divider',
              bgcolor: notesOpen ? 'primary.main' : 'transparent',
              color: notesOpen ? '#fff' : 'text.secondary',
              '&:hover': { bgcolor: notesOpen ? 'primary.dark' : 'action.hover' },
            }}
          >
            <NoteAdd fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap', alignItems: 'center', pl: { xs: 0, sm: 4.5 } }}>
          {tutorial?.subcategory && (
            <Chip label={tutorial.subcategory} size="small" color="primary" sx={{ fontSize: '0.7rem', height: 22 }} />
          )}
          {readingTime && !loading && (
            <Chip
              icon={<AccessTime sx={{ fontSize: '0.8rem !important' }} />}
              label={readingTime}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {notes.length > 0 && (
            <Chip label={`${notes.length} note${notes.length > 1 ? 's' : ''}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
          )}
          {subPage && (
            <Chip
              label={subPage.replace(/-/g, ' ')}
              size="small"
              variant="outlined"
              color="secondary"
              onDelete={handleBackToMain}
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {!subPage && tutorial?.tags?.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
          ))}
        </Box>
      </Box>

      {/* Notes panel */}
      <Collapse in={notesOpen}>
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>📝 Notes for this tutorial</Typography>
            {notes.length > 0 && (
              <Tooltip title="Export notes as Markdown">
                <IconButton size="small" onClick={exportNotesAsMd}><FileDownload fontSize="small" /></IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small" fullWidth multiline maxRows={3}
              placeholder="Add a note about what you learned..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
            />
            <Button variant="contained" onClick={handleAddNote} disabled={!newNote.trim()}
              sx={{ minWidth: 'auto', px: 2 }}>
              <Save fontSize="small" />
            </Button>
          </Box>
          {notes.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
              No notes yet.
            </Typography>
          ) : (
            notes.map((note) => (
              <Box key={note.id} sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1, py: 1,
                borderBottom: '1px solid', borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}>
                <Typography variant="body2" sx={{ flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {note.text}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </Typography>
                  <IconButton size="small" onClick={() => handleDeleteNote(note.id)} color="error">
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))
          )}
        </Paper>
      </Collapse>

      {/* Animated Simulation */}
      {!loading && !subPage && simulationMap[id] && (
        <SimulationViewer config={simulationMap[id]} />
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <MarkdownViewer content={content} onNavigate={handleSubNavigate} />
      )}

      {/* Interview Panel — floating FAB + drawer */}
      {!loading && !subPage && <InterviewPanel content={content} />}

      {/* Flashcard Mode — fullscreen overlay */}
      {flashcardOpen && (
        <FlashcardMode
          blocks={interviewBlocks}
          tutorialTitle={tutorial?.title || id}
          onClose={() => setFlashcardOpen(false)}
        />
      )}

      {/* Prev / Next navigation */}
      {!loading && !subPage && (prev || next) && (
        <>
          <Divider sx={{ mt: 6, mb: 3 }} />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 2, mb: 2 }}>
            {prev ? (
              <Box
                onClick={() => navigate(`/tutorials/${prev.id}`)}
                sx={{
                  flex: 1, p: 2, borderRadius: 2, cursor: 'pointer',
                  border: '1px solid', borderColor: 'divider',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <ArrowBackIos sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">Previous</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{prev.title}</Typography>
              </Box>
            ) : <Box sx={{ flex: 1 }} />}

            {next ? (
              <Box
                onClick={() => navigate(`/tutorials/${next.id}`)}
                sx={{
                  flex: 1, p: 2, borderRadius: 2, cursor: 'pointer', textAlign: 'right',
                  border: '1px solid', borderColor: 'divider',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Next</Typography>
                  <ArrowForwardIos sx={{ fontSize: 12, color: 'text.secondary' }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{next.title}</Typography>
              </Box>
            ) : <Box sx={{ flex: 1 }} />}
          </Box>
        </>
      )}
    </Box>
  );
}
