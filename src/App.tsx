import { useEffect, useState } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';
import AppRoutes from './routes/AppRoutes';
import { AppProvider } from './lib/contexts/AppContext';
import { initializeApp } from './lib/init';
import LoadingScreen from './components/PreAuth/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';

import './App.css';

function App() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initialize = async () => {
            try {
                await initializeApp();
                setIsInitialized(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to initialize app');
            }
        };

        initialize();
    }, []);

    if (error) {
        return (
            <div className="error-boundary">
                <h2>Failed to initialize application</h2>
                <p>{error}</p>
            </div>
        );
    }

    if (!isInitialized) {
        return <LoadingScreen message="Initializing application..." />;
    }

    return (
        <ErrorBoundary>
            <AppProvider>
                <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <ThemeProvider theme={theme}>
                        <AppRoutes />
                    </ThemeProvider>
                </LocalizationProvider>
            </AppProvider>
        </ErrorBoundary>
    );
}

export default App;