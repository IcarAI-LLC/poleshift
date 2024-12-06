import React, { useState } from 'react';
import { useAuth } from '../lib/hooks';
import type { PreAuthView } from '../lib/types';
import LoadingScreen from '../components/PreAuth/LoadingScreen';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import MainApp from '../components/MainApp';
import ActivateLicense from '../components/PreAuth/ActivateLicense';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading: authLoading, userProfile } = useAuth();
  const [currentView, setCurrentView] = useState<PreAuthView>('login');

  // State to handle prefilled login email and message after signup
  const [prefillEmail, setPrefillEmail] = useState<string>('');
  const [loginMessage, setLoginMessage] = useState<string>('');

  if (authLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }

  if (!isAuthenticated) {
    const handleNavigate = (
        view: PreAuthView,
        data?: { email?: string; message?: string }
    ) => {
      if (view === 'login' && data) {
        if (data.email) setPrefillEmail(data.email);
        if (data.message) setLoginMessage(data.message);
      } else if (view !== 'login') {
        // Clear prefill and message if going to a different view
        setPrefillEmail('');
        setLoginMessage('');
      }
      setCurrentView(view);
    };

    switch (currentView) {
      case 'signup':
        return <SignUp onNavigate={handleNavigate} />;
      case 'reset-password':
        return <ResetPassword onNavigate={handleNavigate} />;
      default:
        return (
            <Login
                onNavigate={handleNavigate}
                prefillEmail={prefillEmail}
                message={loginMessage}
            />
        );
    }
  }

  if (isAuthenticated && !userProfile) {
    return <ActivateLicense />;
  }

  return <MainApp />;
};

export default AppRoutes;
