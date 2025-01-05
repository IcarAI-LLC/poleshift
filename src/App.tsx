// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ThemeProvider } from '@mui/material/styles';
import { PowerSyncContext } from '@powersync/react';

import { theme } from './theme';
import PreAuth from './components/PreAuth/PreAuth.tsx';
import './App.css';
import { db, setupPowerSync } from './lib/powersync/db';
import { checkForAppUpdates } from './updater';

// Import the TooltipProvider from shadcn/ui
import { TooltipProvider } from '@/components/ui/tooltip';
// Adjust the import path above to match where you've placed your shadcn ui components

function App() {
    useEffect(() => {
        checkForAppUpdates();
    }, []);

    const [initialized, setInitialized] = useState(false);

    useMemo(() => {
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
                    {/* TooltipProvider must wrap any components using <Tooltip> */}
                    <TooltipProvider>
                        <PreAuth />
                    </TooltipProvider>
                </ThemeProvider>
            </LocalizationProvider>
        </PowerSyncContext.Provider>
    );
}

export default App;
