// src/App.tsx
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';
import AppRoutes from './routes/AppRoutes';
import './App.css';
import {setupPowerSync} from "./lib/powersync/db.ts";

function App() {
    try {
        setupPowerSync();
        // Continue with app initialization
    } catch (error) {
        console.error('PowerSync setup failed:', error);
        // Handle error appropriately
    }

    return (
            <LocalizationProvider dateAdapter={AdapterLuxon}>
                <ThemeProvider theme={theme}>
                    <AppRoutes />
                </ThemeProvider>
            </LocalizationProvider>
    );
}

export default App;
