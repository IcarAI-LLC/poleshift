import React, { useState, useEffect } from 'react';
import LoadingScreen from '../components/PreAuth/LoadingScreen';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import MainApp from '../components/MainApp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import { useAuth } from '../lib/hooks';

interface PreAuthView {
  view: 'login' | 'signup' | 'reset-password';
}

const AppRoutes: React.FC = () => {
  const { user, loading: authLoading, error: authError, initializeAuth } = useAuth();
  const [currentView, setCurrentView] = useState<PreAuthView['view']>('login');
  const [isInitializing, setIsInitializing] = useState(true);

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