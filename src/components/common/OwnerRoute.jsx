import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../../lib/firebase';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { Google, Lock } from '@mui/icons-material';

const OWNER_EMAIL = 'vinfin1323@gmail.com';

export default function OwnerRoute({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  if (user === undefined) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{
        minHeight: '80vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
      }}>
        <Lock sx={{ fontSize: 56, color: 'text.disabled' }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Private Section</Typography>
          <Typography variant="body2" color="text.secondary">
            This page is for the owner only.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<Google />}
          onClick={signInWithGoogle}
          sx={{ textTransform: 'none', px: 4 }}
        >
          Sign in with Google
        </Button>
      </Box>
    );
  }

  if (user.email !== OWNER_EMAIL) {
    signOutUser();
    return (
      <Box sx={{
        minHeight: '80vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        <Lock sx={{ fontSize: 56, color: 'error.main' }} />
        <Typography variant="h6" color="error">Access Denied</Typography>
        <Typography variant="body2" color="text.secondary">This page is private.</Typography>
      </Box>
    );
  }

  return children;
}
