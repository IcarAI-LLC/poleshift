// src/App.tsx
import { useEffect, useState } from 'react';
import { PowerSyncContext } from '@powersync/react';
import PreAuth from './components/PreAuth/PreAuth.tsx';
import './App.css';
import { db, setupPowerSync } from './lib/powersync/db';
import { checkForAppUpdates } from './updater';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider } from '@/components/ui/toast.tsx';
import { Toaster } from '@/components/ui/toaster.tsx';
import DnaLoadingIcon from '@/components/DnaLoadingIcon.tsx';
import { ThemeProvider } from '@/components/ui/theme-provider.tsx';

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
    return (
      <div className={'@container flex justify-center items-center h-screen'}>
        <DnaLoadingIcon
          width={100}
          height={100}
          text={'Initializing Poleshift'}
        />
      </div>
    );
  }

  return (
    <PowerSyncContext.Provider value={db}>
      <ThemeProvider defaultTheme='system' storageKey='vite-ui-theme'>
          <ToastProvider>
            <TooltipProvider>
              <PreAuth />
              <Toaster></Toaster>
            </TooltipProvider>
          </ToastProvider>
      </ThemeProvider>
    </PowerSyncContext.Provider>
  );
}

export default App;
