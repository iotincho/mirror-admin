import { defaultDarkTheme } from 'react-admin';
import type { RaThemeOptions } from 'react-admin';

export const theme: RaThemeOptions = {
  ...defaultDarkTheme,
  sidebar: { width: 240, closedWidth: 64 },
  palette: {
    mode: 'dark',
    primary: { main: '#b8d6ce', contrastText: '#162b28' },
    secondary: { main: '#d5b77e' },
    background: { default: '#111c1e', paper: '#182528' },
    text: { primary: '#eeeade', secondary: '#a5b6b6' },
    divider: '#304044',
    success: { main: '#b8d6ce' },
    warning: { main: '#d5b77e' },
    error: { main: '#edaaa0' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: 13,
    h1: { fontFamily: 'Georgia, serif', fontSize: '2.3rem', fontWeight: 400, letterSpacing: '-.035em' },
    h2: { fontSize: '1rem', fontWeight: 600 },
    h3: { fontSize: '.95rem', fontWeight: 550 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    ...defaultDarkTheme.components,
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { styleOverrides: { root: { border: '1px solid #304044', boxShadow: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 44 } } },
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
    MuiInputBase: { styleOverrides: { root: { '@media (max-width: 600px)': { fontSize: 16 } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: '#304044' }, head: { color: '#a5b6b6', fontSize: 11, letterSpacing: '.04em', whiteSpace: 'nowrap' } } },
    MuiCssBaseline: { styleOverrides: { body: { minWidth: 320 }, ':focus-visible': { outline: '2px solid #d5b77e', outlineOffset: 3 } } },
  },
};
