import { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Paper, Grid, Dialog,
  DialogTitle, DialogContent, DialogActions, Chip, Tooltip,
} from '@mui/material';
import { Delete, Edit, NoteAdd, FileDownload } from '@mui/icons-material';

const STORAGE_KEY = 'archnorth-notes';

const exportAllAsMarkdown = (notes) => {
  if (notes.length === 0) return;
  const md = `# My Notes\n_Exported from ArchNorth on ${new Date().toLocaleDateString()}_\n\n---\n\n` +
    notes.map((n) =>
      `## ${n.title}${n.tag ? ` \`${n.tag}\`` : ''}\n_${new Date(n.updatedAt).toLocaleDateString()}_\n\n${n.content}`
    ).join('\n\n---\n\n');
  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archnorth-notes-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

const loadNotes = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
};

export default function Notes() {
  const [notes, setNotes] = useState(loadNotes);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', tag: '' });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }, [notes]);

  const handleSave = () => {
    if (!form.title.trim()) return;
    const note = {
      ...form,
      id: editing?.id || Date.now(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) =>
      editing ? prev.map((n) => (n.id === editing.id ? note : n)) : [note, ...prev]
    );
    handleClose();
  };

  const handleDelete = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const handleEdit = (note) => {
    setEditing(note);
    setForm({ title: note.title, content: note.content, tag: note.tag || '' });
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditing(null); setForm({ title: '', content: '', tag: '' }); };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Notes</Typography>
          <Typography variant="body2" color="text.secondary">{notes.length} note{notes.length !== 1 && 's'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {notes.length > 0 && (
            <Tooltip title="Export all notes as Markdown">
              <Button variant="outlined" startIcon={<FileDownload />} onClick={() => exportAllAsMarkdown(notes)} size="small">
                Export
              </Button>
            </Tooltip>
          )}
          <Button variant="contained" startIcon={<NoteAdd />} onClick={() => setOpen(true)}>
            New Note
          </Button>
        </Box>
      </Box>

      {notes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <NoteAdd sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography>No notes yet. Create your first note!</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {notes.map((note, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={note.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  animation: `noteIn 0.3s ease ${i * 0.06}s both`,
                  '@keyframes noteIn': {
                    from: { opacity: 0, transform: 'scale(0.95)' },
                    to: { opacity: 1, transform: 'scale(1)' },
                  },
                  '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 20px var(--card-shadow)' },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>{note.title}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                    <IconButton size="small" onClick={() => handleEdit(note)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(note.id)} color="error"><Delete fontSize="small" /></IconButton>
                  </Box>
                </Box>
                {note.tag && <Chip label={note.tag} size="small" sx={{ mb: 1, alignSelf: 'flex-start', fontSize: '0.7rem' }} />}
                <Typography variant="body2" color="text.secondary" sx={{
                  flex: 1, whiteSpace: 'pre-wrap', overflow: 'hidden',
                  display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical',
                }}>
                  {note.content}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
                  {new Date(note.updatedAt).toLocaleDateString()}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Note' : 'New Note'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Title" fullWidth value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField label="Tag (optional)" fullWidth value={form.tag} size="small"
            onChange={(e) => setForm({ ...form, tag: e.target.value })} />
          <TextField label="Content" fullWidth multiline rows={8} value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title.trim()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
