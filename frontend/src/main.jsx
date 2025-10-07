import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";


// const theme = createTheme({
//   palette: {
//     mode: "light", // or 'dark'
//   },
// });

const typefaceTheme = createTheme({
  palette: {
    primary: {
      main: '#D90429', // A strong, Typeface-like red
    },
    secondary: {
      main: '#2D3748', // A dark grey for secondary elements
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    // Optional: Give buttons and cards a sharper, more modern look
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none', // Buttons with normal capitalization
        },
      },
    },
    MuiPaper: {
        styleOverrides: {
            root: {
                borderRadius: 12,
            }
        }
    }
  },
});


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={typefaceTheme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <AuthProvider>
            {/* <ThemeProvider theme={typefaceTheme}> */}
              <CssBaseline />
              <App />
            {/* </ThemeProvider> */}
          </AuthProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
