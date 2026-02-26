import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f766e",
    },
    secondary: {
      main: "#334155",
    },
    background: {
      default: "#f7f8fb",
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
