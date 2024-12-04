// src/lib/hooks/useAuth.ts
import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
    // Subscribe to specific pieces of state to trigger re-renders
    const user = useAuthStore((state) => state.user);
    const userProfile = useAuthStore((state) => state.userProfile);
    const organization = useAuthStore((state) => state.organization);
    const error = useAuthStore((state) => state.error);
    const loading = useAuthStore((state) => state.loading);
    const initialized = useAuthStore((state) => state.initialized);
    const connector = useAuthStore((state) => state.connector);

    // Actions
    const login = useAuthStore((state) => state.login);
    const signUp = useAuthStore((state) => state.signUp);
    const logout = useAuthStore((state) => state.logout);
    const resetPassword = useAuthStore((state) => state.resetPassword);
    const processLicenseKey = useAuthStore((state) => state.processLicenseKey);
    const initializeAuth = useAuthStore((state) => state.initializeAuth);
    const setError = useAuthStore((state) => state.setError);

    // Memoized handlers to prevent unnecessary re-renders
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
    const isAuthenticated = Boolean(user && userProfile && connector);
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
        connector,

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
