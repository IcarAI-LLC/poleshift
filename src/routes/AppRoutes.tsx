// src/routes/AppRoutes.tsx
import React, { useState } from 'react';
import { useAuth } from '../lib/hooks';
import type { PreAuthView } from '../lib/types';
import LoadingScreen from '../components/PreAuth/LoadingScreen';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import MainApp from '../components/MainApp';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState<PreAuthView>('login');

  if (authLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }
  if (!isAuthenticated) {
    switch (currentView) {
      case 'signup':
        return <SignUp onNavigate={setCurrentView} />;
      case 'reset-password':
        return <ResetPassword onNavigate={setCurrentView} />;
      default:
        return <Login onNavigate={setCurrentView} />;
    }
  }

  return <MainApp />;
};

export default AppRoutes;
