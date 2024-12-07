import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/hooks';
import type { PreAuthView } from '../lib/types';
import LoadingScreen from '../components/PreAuth/LoadingScreen';
import Login from '../components/PreAuth/Login';
import SignUp from '../components/PreAuth/SignUp';
import ResetPassword from '../components/PreAuth/ResetPassword';
import MainApp from '../components/MainApp';
import ActivateLicense from '../components/PreAuth/ActivateLicense';

const WAIT_TIME_MS = 20000; // 20 seconds

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading: authLoading, userProfile } = useAuth();
  const [currentView, setCurrentView] = useState<PreAuthView>('login');

  // State to handle prefilled login email and message after signup
  const [prefillEmail, setPrefillEmail] = useState<string>('');
  const [loginMessage, setLoginMessage] = useState<string>('');

  // State to handle waiting for userProfile
  const [waitingForProfile, setWaitingForProfile] = useState<boolean>(false);
  const [profileFetchTimedOut, setProfileFetchTimedOut] = useState<boolean>(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (isAuthenticated && !userProfile) {
      setWaitingForProfile(true);
      setProfileFetchTimedOut(false);

      // Start a 20-second timer
      timeoutId = setTimeout(() => {
        setProfileFetchTimedOut(true);
        setWaitingForProfile(false);
      }, WAIT_TIME_MS);
    } else {
      // If we get a profile or user logs out, clear waiting states
      setWaitingForProfile(false);
      setProfileFetchTimedOut(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, userProfile]);

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
    // If still waiting for the profile within the 20-second window
    if (waitingForProfile && !profileFetchTimedOut) {
      return <LoadingScreen message="Loading your profile, please wait..." />;
    }

    // If timed out (no profile after 20 seconds), show ActivateLicense
    if (profileFetchTimedOut) {
      return <ActivateLicense />;
    }

    // If not timed out but somehow waitingForProfile is false and still no profile,
    // fallback to a loading screen (this scenario should be rare).
    return <LoadingScreen message="Loading your profile, please wait..." />;
  }

  return <MainApp />;
};

export default AppRoutes;
