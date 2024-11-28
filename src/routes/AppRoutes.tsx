// src/renderer/routes/AppRoutes.tsx

import React, { useState, useEffect } from 'react';
import LoadingScreen from '../components/PreAuth/LoadingScreen';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import MainApp from '../components/MainApp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import {useAuth, useData, useLocations} from '../lib/hooks';

const AppRoutes: React.FC = () => {
  const { user, loading: authLoading, error: authError } = useAuth();
  const { syncData, isSyncing, error: syncError } = useData();
  const { syncLocations } = useLocations();
  const [currentView, setCurrentView] = useState<
      'login' | 'signup' | 'reset-password'
  >('login');
  const [isInitializing, setIsInitializing] = useState(true);
  const [initAttempts, setInitAttempts] = useState(0);
  const MAX_INIT_ATTEMPTS = 3;

  useEffect(() => {
    let initTimeout: number;
    let mounted = true;

    const initializeApp = async () => {
      if (!mounted) return;

      if (user) {
        try {
          await syncData();
          await syncLocations();
        } catch (error) {
          console.error('Initial sync failed:', error);
          // Increment attempt counter
          setInitAttempts(prev => prev + 1);
        }
      }

      // Only proceed if still mounted
      if (mounted) {
        initTimeout = window.setTimeout(() => {
          setIsInitializing(false);
        }, 1000);
      }
    };

    // Only initialize if auth is done loading and we haven't exceeded max attempts
    if (!authLoading && isInitializing && initAttempts < MAX_INIT_ATTEMPTS) {
      initializeApp();
    } else if (initAttempts >= MAX_INIT_ATTEMPTS) {
      // If we've exceeded max attempts, stop initializing
      setIsInitializing(false);
      console.error('Max initialization attempts reached');
    }

    return () => {
      mounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
    };
  }, [user, authLoading, syncData, isInitializing, initAttempts]);

  // Get loading message based on state
  const getLoadingMessage = () => {
    if (authError) return `Authentication error: ${authError}`;
    if (syncError) return `Sync error: ${syncError}`;
    if (authLoading) return "Authenticating...";
    if (isSyncing) return "Syncing your data...";
    if (isInitializing) return `Initializing application... Attempt ${initAttempts + 1}/${MAX_INIT_ATTEMPTS}`;
    return "Loading...";
  };

  // Show appropriate loading screen
  if (authLoading || isInitializing) {
    return <LoadingScreen message={getLoadingMessage()} />;
  }

  // Handle errors
  if (authError || syncError) {
    return <Login onNavigate={setCurrentView} />;
  }

  // Show auth flow if no user
  if (!user) {
    switch (currentView) {
      case 'signup':
        return <SignUp onNavigate={setCurrentView} />;
      case 'reset-password':
        return <ResetPassword onNavigate={setCurrentView} />;
      default:
        return <Login onNavigate={setCurrentView} />;
    }
  }

  // User is authenticated and app is initialized, show main app
  return <MainApp />;
};

export default AppRoutes;