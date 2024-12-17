import React, { useState } from 'react';
import { useAuth } from '../../lib/hooks';
import type { PreAuthView } from '../../lib/types';
import LoadingScreen from './LoadingScreen.tsx';
import Login from './Login.tsx';
import SignUp from './SignUp.tsx';
import ResetPassword from './ResetPassword.tsx';
import MainApp from '../MainApp.tsx';
import ActivateLicense from './ActivateLicense.tsx';
import ResetComponent from "../ResetComponent.tsx";

const PreAuth: React.FC = () => {
  const {
    isAuthenticated,
    loading: authLoading,
    profileLoading,
    profileFetchTimedOut,
    logout,
    resetApp
  } = useAuth();

  // Define the reset logic
  const handleReset = async () => {
    try {
      // 1. Logout the user if authenticated
      if (isAuthenticated) {
        await logout();
      }

      // 2. Reset authentication state
      resetApp();

      // 3. Clear any other relevant state
      setCurrentView('login');
      setPrefillEmail('');
      setLoginMessage('');

      // Additional reset actions can be added here
    } catch (error) {
      console.error('Error during reset:', error);
      throw error; // Let ResetComponent handle the alert
    }
  };

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
            <div>
            <ResetComponent onReset={ handleReset } />
            <Login
                onNavigate={handleNavigate}
                prefillEmail={prefillEmail}
                message={loginMessage}
            />
            </div>
        );
    }
  }

  // User is authenticated but we still might not have the profile
  if (profileLoading) {
    return <LoadingScreen message="Loading your profile, please wait..." />;
  }

  // If timed out (no profile after waiting), show ActivateLicense
  if (profileFetchTimedOut) {
    return <ActivateLicense />;
  }

  // If userProfile is present, go to MainApp
  return <MainApp />;
};

export default PreAuth;
