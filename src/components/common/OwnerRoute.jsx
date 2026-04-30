import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../../lib/firebase';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { Google, Lock } from '@mui/icons-material';

const OWNER_EMAIL = 'vinayakvsvs@gmail.com';

export default function OwnerRoute({ children }) {
  const [user, setUser] = useState(undefined); // undefined = auth not resolved yet

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  // Sign out wrong accounts from an effect — never directly in render
  useEffect(() => {
    if (user && user.email && user.email !== OWNER_EMAIL) {
      signOutUser();
    }
  }, [user]);

  // Auth not resolved yet, or signed in but Google profile still loading (email briefly null)
  if (user === undefined || (user !== null && !user.email)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // Not signed in
  if (user === null) {
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

  // Wrong account — signOutUser() handled by the effect above, not here
  if (user.email !== OWNER_EMAIL) {
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
