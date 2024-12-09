// src/App.tsx
import React, {useEffect} from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ThemeProvider } from '@mui/material/styles';
import { PowerSyncContext } from '@powersync/react';

import { theme } from './theme';
import PreAuth from './components/PreAuth/PreAuth.tsx';
import './App.css';
import { db, setupPowerSync } from './lib/powersync/db';
import { checkForAppUpdates } from './updater';

function App() {
    useEffect(() => {
        checkForAppUpdates();
    }, []);
    const [initialized, setInitialized] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            await setupPowerSync(); // Connect to PowerSync
            setInitialized(true);
        })();
    }, []);

    if (!initialized) {
        return <div>Initializing PowerSync...</div>;
    }

    return (
        <PowerSyncContext.Provider value={db}>
            <LocalizationProvider dateAdapter={AdapterLuxon}>
                <ThemeProvider theme={theme}>
                    <PreAuth />
                </ThemeProvider>
            </LocalizationProvider>
        </PowerSyncContext.Provider>
    );
}

export default App;
