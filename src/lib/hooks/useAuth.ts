// src/lib/hooks/useAuth.ts

import { useAuthStore } from '../stores/authStore';
import { supabaseConnector } from '../powersync/SupabaseConnector';
import { useCallback, useEffect } from 'react';
import { fetchUserProfile, fetchOrganization, createUserProfile } from '../services/userService';
import { processLicenseKey } from '../services/licenseService'; // Import the license service

export const useAuth = () => {
    const user = useAuthStore((state) => state.user);
    const userProfile = useAuthStore((state) => state.userProfile);
    const organization = useAuthStore((state) => state.organization);
    const error = useAuthStore((state) => state.error);
    const loading = useAuthStore((state) => state.loading);
    const setError = useAuthStore((state) => state.setError);
    const setLoading = useAuthStore((state) => state.setLoading);
    const setUser = useAuthStore((state) => state.setUser);
    const setUserProfile = useAuthStore((state) => state.setUserProfile);
    const setOrganization = useAuthStore((state) => state.setOrganization);

    // Helper function to load user profile and organization
    const loadUserData = useCallback(async (userId: string) => {
        try {
            const profile = await fetchUserProfile(userId);
            setUserProfile(profile);

            if (profile?.organization_id) {
                const org = await fetchOrganization(profile.organization_id);
                setOrganization(org);
            } else {
                setOrganization(null);
            }
        } catch (err) {
            console.error('Failed to load user data:', err);
            setError('Failed to load user data');
        }
    }, [setUserProfile, setOrganization, setError]);

    // Load user data on mount if user is already logged in
    useEffect(() => {
        const initialize = async () => {
            if (user) {
                await loadUserData(user.id);
            }
        };
        initialize();
    }, [user, loadUserData]);

    // Authentication Actions
    const login = useCallback(async (email: string, password: string) => {
        try {
            setLoading(true);
            await supabaseConnector.login(email, password);

            const loggedInUser = supabaseConnector.currentSession?.user;
            console.log(loggedInUser);
            setUser(loggedInUser || null);
            if (loggedInUser) {
                await loadUserData(loggedInUser.id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading, setUser, loadUserData]);

    const signUp = useCallback(async (email: string, password: string, licenseKey: string) => {
        try {
            setLoading(true);

            // Proceed with sign up
            await supabaseConnector.signUp(email, password);

            // Process the license key first
            const organization = await processLicenseKey(licenseKey);
            if (!organization) {
                throw new Error('Invalid license key.');
            }

            const newUser = supabaseConnector.currentSession?.user;
            setUser(newUser || null);

            if (newUser) {
                // Create user profile with 'lead' role
                const profileData = {
                    id: newUser.id,
                    organization_id: organization.id,
                    user_tier: 'lead' as const, // Type assertion for TypeScript
                };

                await createUserProfile(profileData.id, organization.id);

                // Fetch and set user profile
                await loadUserData(newUser.id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign up failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading, setUser, loadUserData]);

    const logout = useCallback(async () => {
        try {
            setLoading(true);
            await supabaseConnector.logout();
            setUser(null);
            setUserProfile(null);
            setOrganization(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Logout failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading, setUser, setUserProfile, setOrganization]);

    const resetPassword = useCallback(async (email: string) => {
        try {
            setLoading(true);
            await supabaseConnector.resetPassword(email);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Password reset failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading]);

    const isAuthenticated = Boolean(user);

    return {
        user,
        userProfile,
        organization,
        error,
        loading,
        isAuthenticated,
        login,
        signUp,
        logout,
        resetPassword,
        setError,
    };
};

export default useAuth;
