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
      <AppProvider>
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <ThemeProvider theme={theme}>
                <AppRoutes />
          </ThemeProvider>
        </LocalizationProvider>
      </AppProvider>

  );
}

export default App;
