// src/App.tsx
import {StrictMode, useEffect, useState} from 'react';
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
import {ToastProvider} from "@/components/ui/toast.tsx";
import {Toaster} from "@/components/ui/toaster.tsx";

// Track initialization status outside the component scope
let isPowerSyncInitialized = false;

function App() {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        // Check for app updates
        checkForAppUpdates();

        // Initialize PowerSync only if it hasn't been initialized
        if (!isPowerSyncInitialized) {
            isPowerSyncInitialized = true;
            (async () => {
                await setupPowerSync();
                setInitialized(true);
            })();
        } else {
            setInitialized(true); // Skip initialization if already done
        }
    }, []);

    if (!initialized) {
        return <div>Initializing PowerSync...</div>;
    }

    return (
        <StrictMode>
        <PowerSyncContext.Provider value={db}>
            <ToastProvider>
            <LocalizationProvider dateAdapter={AdapterLuxon}>
                <ThemeProvider theme={theme}>
                    <TooltipProvider>
                        <PreAuth/>
                        <Toaster></Toaster>
                    </TooltipProvider>
                </ThemeProvider>
            </LocalizationProvider>
            </ToastProvider>
        </PowerSyncContext.Provider>
        </StrictMode>
    );
}

export default App;
