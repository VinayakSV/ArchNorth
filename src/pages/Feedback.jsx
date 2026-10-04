import { Box, Container, Paper, Typography } from '@mui/material';
import { RateReview } from '@mui/icons-material';
import FeedbackActions from '../components/common/FeedbackActions';
import { FEEDBACK_EMAIL, FEEDBACK_SUBJECT_PREFIX } from '../lib/feedback';

export default function Feedback() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <RateReview color="primary" fontSize="large" />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Feedback</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Spotted a mistake, found something confusing, or have an idea for a topic? Send it by email —
        it goes straight to the ArchNorth inbox, and every message is read.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>What helps most</Typography>
        <Box component="ul" sx={{ pl: 2.5, m: 0, mb: 2.5, '& li': { mb: 0.75 } }}>
          <li><Typography variant="body2">Which tutorial or page (a link is perfect)</Typography></li>
          <li><Typography variant="body2">What looks wrong, confusing, or missing</Typography></li>
          <li><Typography variant="body2">How you would improve it, if you have an idea</Typography></li>
        </Box>
        <FeedbackActions />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Address: <strong>{FEEDBACK_EMAIL}</strong> · Subject starts with <code>{FEEDBACK_SUBJECT_PREFIX}</code>
        </Typography>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        Reading a tutorial? Use the feedback box at the bottom of the page instead — it fills in which tutorial
        you mean. Your email address is only used to reply to you.
      </Typography>
    </Container>
  );
}
