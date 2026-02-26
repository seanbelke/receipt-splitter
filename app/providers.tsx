"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles
          styles={{
            body: {
              background:
                "radial-gradient(circle at 5% 5%, #ffffff, transparent 35%), radial-gradient(circle at 95% 10%, #d5e8f0, transparent 32%), radial-gradient(circle at 100% 100%, #dbeee4, transparent 35%), #f2f6f7",
            },
            ".mono": {
              fontFamily: "var(--font-mono), monospace",
            },
          }}
        />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
