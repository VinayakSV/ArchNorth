import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { Explore, MenuBook, Storefront } from '@mui/icons-material';

/** Shown for unknown URLs and unknown tutorial IDs, instead of an empty page. */
export default function NotFound({ what = 'page' }) {
  const navigate = useNavigate();
  return (
    <Box sx={{
      minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 1.5, px: 3, textAlign: 'center',
    }}>
      <Explore sx={{ fontSize: 48, color: 'primary.main' }} />
      <Typography variant="h5" sx={{ fontWeight: 700 }}>This {what} doesn&apos;t exist</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
        The link may be old or mistyped. Search from the top bar, or pick up where most people start.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button variant="contained" startIcon={<Storefront />} onClick={() => navigate('/tutorials/journey-start')}>
          Start the ShopNorth Journey
        </Button>
        <Button variant="outlined" startIcon={<MenuBook />} onClick={() => navigate('/tutorials')}>
          All tutorials
        </Button>
      </Box>
    </Box>
  );
}
