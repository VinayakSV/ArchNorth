import { useState, useMemo, useEffect, memo } from 'react';
import {
  Fab, Drawer, Box, Typography, IconButton, Zoom, Chip, Divider, Badge,
} from '@mui/material';
import { EmojiEvents, Close, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import MarkdownViewer from './MarkdownViewer';

const DRAWER_WIDTH = { xs: '100vw', sm: 440 };

function extractInterviewBlocks(content) {
  if (!content) return [];
  const blocks = [];
  const regex = /<div\s+class="callout-interview">\s*\n([\s\S]*?)\n\s*<\/div>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

const InterviewPanel = memo(function InterviewPanel({ content }) {
  const [open, setOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const blocks = useMemo(() => extractInterviewBlocks(content), [content]);

  useEffect(() => {
    setOpen(false);
    setExpandedIdx(null);
  }, [content]);

  if (blocks.length === 0) return null;

  const questions = blocks.map((block) => {
    const qMatch = block.match(/\*\*Q:\s*"([^"]+)"\*\*/);
    return qMatch ? qMatch[1] : null;
  });

  return (
    <>
      {/* appear={false}: the enter transition forces a synchronous layout of the whole page on every navigation */}
      <Zoom in appear={false}>
        <Badge
          badgeContent={blocks.length}
          color="error"
          sx={{
            position: 'fixed',
            bottom: { xs: 80, sm: 88 },
            right: { xs: 16, sm: 28 },
            zIndex: 1200,
          }}
        >
          <Fab
            size="medium"
            onClick={() => setOpen(true)}
            aria-label="interview tips"
            sx={{
              bgcolor: '#e74c3c',
              color: '#fff',
              '&:hover': { bgcolor: '#c0392b', transform: 'scale(1.05)' },
              boxShadow: '0 4px 20px rgba(231,76,60,0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <EmojiEvents />
          </Fab>
        </Badge>
      </Zoom>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: DRAWER_WIDTH,
            bgcolor: 'background.default',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2.5, py: 2, borderBottom: '2px solid', borderColor: '#e74c3c',
          position: 'sticky', top: 0, bgcolor: 'background.default', zIndex: 1,
        }}>
          <EmojiEvents sx={{ color: '#e74c3c' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Interview Corner
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {blocks.length} question{blocks.length > 1 ? 's' : ''} for this topic
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {blocks.map((block, i) => {
            const isExpanded = expandedIdx === i;
            const question = questions[i];
            return (
              <Box key={i}>
                {i > 0 && <Divider />}
                <Box
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  sx={{
                    px: 2.5, py: 1.5, cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: 1,
                    bgcolor: isExpanded ? 'rgba(231,76,60,0.04)' : 'transparent',
                    borderLeft: isExpanded ? '4px solid #e74c3c' : '4px solid transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Chip
                    label={`Q${i + 1}`}
                    size="small"
                    sx={{
                      fontSize: '0.7rem', height: 22, mt: 0.2, flexShrink: 0,
                      bgcolor: '#e74c3c', color: '#fff', fontWeight: 700,
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1, fontWeight: 600, lineHeight: 1.5,
                      color: isExpanded ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    {question || `Question ${i + 1}`}
                  </Typography>
                  {isExpanded
                    ? <KeyboardArrowUp sx={{ fontSize: 20, color: 'text.secondary', mt: 0.2 }} />
                    : <KeyboardArrowDown sx={{ fontSize: 20, color: 'text.secondary', mt: 0.2 }} />
                  }
                </Box>
                {isExpanded && (
                  <Box sx={{
                    px: 2.5, pb: 2,
                    borderLeft: '4px solid #e74c3c',
                    bgcolor: 'rgba(231,76,60,0.04)',
                  }}>
                    <MarkdownViewer content={block} />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Drawer>
    </>
  );
});

export default InterviewPanel;
