
import { createTheme } from "@mui/material/styles";

// Create a base theme first to get the default typography
const baseTheme = createTheme();

const googleFont = '"Alex Brush"';

const theme = createTheme({
  typography: {
    // Prepend Google font, keep everything else from the base theme
    fontFamily: [baseTheme.typography.fontFamily].join(','),
    h2: {
      fontFamily: [googleFont, baseTheme.typography.fontFamily].join(','),
      fontWeight: 200,
    },
    h4: {
      fontFamily: [googleFont, baseTheme.typography.fontFamily].join(','),
      fontWeight: 200,
    },
  },
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
    secondary: { main: "#9c27b0" }
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } }
  }
});

export default theme;
