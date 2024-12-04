import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
    // Get state and actions from auth store
    const {
        user,
        userProfile,
        organization,
        error,
        loading,
        initialized,
        login,
        signUp,
        logout,
        resetPassword,
        processLicenseKey,
        initializeAuth,
        setError
    } = useAuthStore();

    // Wrapped handlers with error management
    const handleLogin = useCallback(async (email: string, password: string) => {
        try {
            return await login(email, password);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Login failed');
            throw error;
        }
    }, [login, setError]);

    const handleSignUp = useCallback(async (email: string, password: string, licenseKey: string) => {
        try {
            await signUp(email, password, licenseKey);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Sign up failed');
            throw error;
        }
    }, [signUp, setError]);

    const handleLogout = useCallback(async () => {
        try {
            await logout();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Logout failed');
            throw error;
        }
    }, [logout, setError]);

    const handleResetPassword = useCallback(async (email: string) => {
        try {
            await resetPassword(email);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Password reset failed');
            throw error;
        }
    }, [resetPassword, setError]);

    const handleProcessLicenseKey = useCallback(async (licenseKey: string) => {
        try {
            await processLicenseKey(licenseKey);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'License key processing failed');
            throw error;
        }
    }, [processLicenseKey, setError]);

    // Utility functions
    const isAuthenticated = Boolean(user && userProfile);
    const canAccessAdmin = userProfile?.user_tier === 'admin';
    const hasValidLicense = Boolean(organization);

    return {
        // State
        user,
        userProfile,
        organization,
        error,
        loading,
        initialized,
        isAuthenticated,
        canAccessAdmin,
        hasValidLicense,

        // Actions
        initializeAuth,
        login: handleLogin,
        signUp: handleSignUp,
        logout: handleLogout,
        resetPassword: handleResetPassword,
        processLicenseKey: handleProcessLicenseKey,
        setError,
    };
};

export default useAuth;