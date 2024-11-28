// src/renderer/routes/AppRoutes.tsx

import React, { useState, useEffect } from 'react';
import LoadingScreen from '../components/PreAuth/LoadingScreen';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import MainApp from '../components/MainApp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import { useAuth, useData } from '../lib/hooks';

const AppRoutes: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { syncData, isSyncing } = useData();
  const [currentView, setCurrentView] = useState<
      'login' | 'signup' | 'reset-password'
  >('login');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let initTimeout: number;

    const initializeApp = async () => {
      if (user) {
        try {
          await syncData();
        } catch (error) {
          console.error('Initial sync failed:', error);
          // Continue loading even if sync fails
        }
      }

      // Ensure loading screen shows for at least 1 second to avoid flash
      initTimeout = window.setTimeout(() => {
        setIsInitializing(false);
      }, 1000);
    };

    if (!authLoading) {
      initializeApp();
    }

    return () => {
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
    };
  }, [user, authLoading, syncData]);

  // Show loading screen during authentication or initialization
  if (authLoading || isInitializing) {
    return (
        <LoadingScreen
            message={
              authLoading
                  ? "Authenticating..."
                  : isSyncing
                      ? "Syncing your data..."
                      : "Initializing application..."
            }
        />
    );
  }

  if (!user) {
    // Function to handle navigation between views
    const handleNavigate = (view: 'login' | 'signup' | 'reset-password') => {
      setCurrentView(view);
    };

    // Render the appropriate component based on currentView
    switch (currentView) {
      case 'login':
        return <Login onNavigate={handleNavigate} />;
      case 'signup':
        return <SignUp onNavigate={handleNavigate} />;
      case 'reset-password':
        return <ResetPassword onNavigate={handleNavigate} />;
      default:
        return <Login onNavigate={handleNavigate} />;
    }
  }

  // User is authenticated, show main app
  return <MainApp />;
};

export default AppRoutes;