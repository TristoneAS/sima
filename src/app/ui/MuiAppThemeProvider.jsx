"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { BRAND } from "@/libs/theme_palette";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: BRAND.primary,
      dark: BRAND.primaryDark,
      light: BRAND.primaryLight,
      contrastText: "#ffffff",
    },
    secondary: {
      main: BRAND.navy,
      contrastText: "#ffffff",
    },
    background: {
      default: BRAND.bg,
      paper: BRAND.paper,
    },
    text: {
      primary: BRAND.ink,
      secondary: BRAND.muted,
    },
    divider: BRAND.border,
    error: { main: "#D32F2F" },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: 'var(--font-roboto, "Roboto", "Helvetica", "Arial", sans-serif)',
    h5: { fontWeight: 800, color: BRAND.ink },
    h6: { fontWeight: 700, color: BRAND.ink },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: BRAND.bg,
          color: BRAND.ink,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`,
          color: "#ffffff",
          boxShadow: `0 6px 16px ${BRAND.glow}`,
          "&:hover": {
            background: `linear-gradient(135deg, ${BRAND.primaryDeep} 0%, ${BRAND.primaryDark} 100%)`,
          },
        },
      },
    },
  },
});

export default function MuiAppThemeProvider({ children }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui", prepend: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
