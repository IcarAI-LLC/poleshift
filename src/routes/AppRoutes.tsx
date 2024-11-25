// src/renderer/routes/AppRoutes.tsx

import React, { useState } from 'react';
import Loading from '../components/Loading';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import MainApp from '../components/MainApp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import useAuth from '../old_hooks/useAuth';

const AppRoutes: React.FC = () => {
  const { user, loading} = useAuth();
  const [currentView, setCurrentView] = useState<
    'login' | 'signup' | 'reset-password'
  >('login');

  if (loading) {
    return <Loading />;
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
