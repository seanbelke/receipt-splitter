import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#008148",
      dark: "#00663a",
      light: "#39a96b",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#2D728F",
      dark: "#255e75",
      light: "#5793ab",
      contrastText: "#ffffff",
    },
    error: {
      main: "#632B30",
      contrastText: "#ffffff",
    },
    warning: {
      main: "#FFCDB2",
      dark: "#7f4e35",
      contrastText: "#1C1D21",
    },
    text: {
      primary: "#1C1D21",
      secondary: "#3f454e",
    },
    background: {
      default: "#f2f6f7",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "var(--font-heading), sans-serif",
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
});

export default theme;
