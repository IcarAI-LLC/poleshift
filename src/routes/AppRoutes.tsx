// src/renderer/routes/AppRoutes.tsx

import React, { useState, useEffect, useContext } from 'react';
import LoadingScreen from '../components/PreAuth/LoadingScreen';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import MainApp from '../components/MainApp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import { AppContext } from "../lib/contexts/AppContext";
import { useAuth } from '../lib/hooks';

const AppRoutes: React.FC = () => {
  const { state } = useContext(AppContext);
  const { user, loading: authLoading, error: authError } = state.auth;
  const [currentView, setCurrentView] = useState<
      'login' | 'signup' | 'reset-password'
  >('login');
  const [isInitializing, setIsInitializing] = useState(true);

  // Auth hook to handle authentication logic
  const { initializeAuth } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    if (isInitializing) {
      initializeApp();
    }

    return () => {
      isMounted = false;
    };
  }, [initializeAuth, isInitializing]);

  // Get loading message based on state
  const getLoadingMessage = () => {
    if (authError) return `Authentication error: ${authError}`;
    if (authLoading) return "Authenticating...";
    if (isInitializing) return "Initializing application...";
    return "Loading...";
  };

  // Show appropriate loading screen
  if (authLoading || isInitializing) {
    return <LoadingScreen message={getLoadingMessage()} />;
  }

  // Handle errors
  if (authError) {
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
