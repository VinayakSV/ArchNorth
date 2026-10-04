import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeProvider';

export default function useThemeMode() {
  return useContext(ThemeContext);
}
