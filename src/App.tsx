// src/App.tsx
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';
import AppRoutes from './routes/AppRoutes';
import './App.css';
import {db} from "./lib/powersync/db.ts";

function App() {
    console.log(db);
    return (
            <LocalizationProvider dateAdapter={AdapterLuxon}>
                <ThemeProvider theme={theme}>
                    <AppRoutes />
                </ThemeProvider>
            </LocalizationProvider>
    );
}

export default App;
