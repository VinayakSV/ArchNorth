import { useState, useMemo } from 'react';
import {
  Box, Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Snackbar, Typography,
} from '@mui/material';
import {
  MailOutline, ContentCopy, ArrowDropDown, OpenInNew, Laptop, Notes,
} from '@mui/icons-material';
import {
  FEEDBACK_EMAIL, feedbackMessage, mailtoLink, gmailLink, outlookLink, plainTextMessage,
} from '../../lib/feedback';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (older browser, insecure context): let the visitor copy by hand.
    window.prompt('Copy this:', text);
    return false;
  }
}

/**
 * "Send feedback" opens a menu: Gmail or Outlook.com in the browser (work on any computer),
 * the visitor's own email app (mailto), or copying the message. "Copy address" is always visible.
 */
export default function FeedbackActions({ topic, pageUrl, size = 'medium' }) {
  const [anchor, setAnchor] = useState(null);
  const [toast, setToast] = useState('');
  const message = useMemo(() => feedbackMessage({ topic, pageUrl }), [topic, pageUrl]);

  const close = () => setAnchor(null);
  const copy = async (text, done) => {
    close();
    if (await copyText(text)) setToast(done);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="contained" size={size} startIcon={<MailOutline />} endIcon={<ArrowDropDown />}
          aria-haspopup="menu" aria-expanded={Boolean(anchor)}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          Send feedback
        </Button>
        <Button variant="outlined" size={size} startIcon={<ContentCopy />}
          onClick={() => copy(FEEDBACK_EMAIL, `Copied ${FEEDBACK_EMAIL}`)}>
          Copy address
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Nothing opens? Pick Gmail or Outlook.com from the menu, or copy the address into any email service.
      </Typography>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        <MenuItem component="a" href={gmailLink(message)} target="_blank" rel="noopener noreferrer" onClick={close}>
          <ListItemIcon><OpenInNew fontSize="small" /></ListItemIcon>
          <ListItemText primary="Gmail" secondary="Opens in a new tab" />
        </MenuItem>
        <MenuItem component="a" href={outlookLink(message)} target="_blank" rel="noopener noreferrer" onClick={close}>
          <ListItemIcon><OpenInNew fontSize="small" /></ListItemIcon>
          <ListItemText primary="Outlook.com" secondary="Opens in a new tab" />
        </MenuItem>
        <MenuItem component="a" href={mailtoLink(message)} onClick={close}>
          <ListItemIcon><Laptop fontSize="small" /></ListItemIcon>
          <ListItemText primary="My email app" secondary="Outlook, Apple Mail, Thunderbird, phone mail…" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => copy(plainTextMessage(message), 'Message copied — paste it into any email')}>
          <ListItemIcon><Notes fontSize="small" /></ListItemIcon>
          <ListItemText primary="Copy message text" secondary="Address, subject and template" />
        </MenuItem>
      </Menu>

      <Snackbar
        open={Boolean(toast)} autoHideDuration={2500} onClose={() => setToast('')}
        message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
