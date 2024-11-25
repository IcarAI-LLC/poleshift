// src/App.tsx

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ThemeProvider } from '@mui/material/styles';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { UIProvider } from './contexts/UIContext';
import { ProcessedDataProvider } from './contexts/ProcessedDataContext.tsx';
import AppRoutes from './routes/AppRoutes';
import { theme } from './theme.ts';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <ThemeProvider theme={theme}>
            {/* Removed Router */}
            <DataProvider>
              <ProcessedDataProvider>
                <AppRoutes />
              </ProcessedDataProvider>
            </DataProvider>
          </ThemeProvider>
        </LocalizationProvider>
      </UIProvider>
    </AuthProvider>
  );
}

export default App;
