import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../../lib/firebase';
import { Box, Button, Typography } from '@mui/material';
import AppLoader from './AppLoader';
import { Google, Lock } from '@mui/icons-material';

// The owner's Firebase Auth user ID. Not a secret: it identifies the account without revealing
// an email address, and it can't be used to sign in.
const OWNER_UID = 'cuWLDOkWOkYl8Gtxb6VEOzwiGrf2';

export default function OwnerRoute({ children }) {
  const [user, setUser] = useState(undefined); // undefined = auth not resolved yet

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  // Sign out wrong accounts from an effect — never directly in render
  useEffect(() => {
    if (user && user.uid !== OWNER_UID) {
      signOutUser();
    }
  }, [user]);

  // Auth not resolved yet
  if (user === undefined) {
    return (
      <AppLoader variant="page" label="Checking sign-in…" />
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
  if (user.uid !== OWNER_UID) {
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
