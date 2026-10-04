import { createTheme } from '@mui/material/styles';

const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'light'
        ? {
            background: { default: '#f5f0eb', paper: '#faf7f3' },
            text: { primary: '#2d2a26', secondary: '#5c574f' },
            primary: { main: '#4a7c6f', light: '#6a9c8f', dark: '#3d6a5e' },
            divider: '#ddd5cc',
          }
        : {
            background: { default: '#1a1b1e', paper: '#242529' },
            text: { primary: '#e0dcd5', secondary: '#9e9a93' },
            primary: { main: '#7fbfae', light: '#99d1c3', dark: '#6aab99' },
            divider: '#35363a',
          }),
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', transition: 'background-color 0.3s ease, box-shadow 0.3s ease' },
        },
      },
      MuiDrawer: {
        styleOverrides: { paper: { borderRight: 'none' } },
      },
    },
  });

export default getTheme;
