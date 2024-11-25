// src/App.tsx

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ThemeProvider } from '@mui/material/styles';
import {AppProvider} from "./lib/contexts/AppContext.tsx";
import AppRoutes from './routes/AppRoutes';
import { theme } from './theme.ts';

import './App.css';

function App() {
  return (
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <AppProvider>
          <ThemeProvider theme={theme}>
                <AppRoutes />
          </ThemeProvider>
          </AppProvider>
        </LocalizationProvider>
  );
}

export default App;
