import { useAuthStore } from '../stores/authStore';
import { supabaseConnector } from '../powersync/SupabaseConnector';
import { useCallback, useEffect } from 'react';
import { fetchUserProfile, fetchOrganization } from '../services/userService';

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

    useEffect(() => {
        const initialize = async () => {
            if (user) {
                await loadUserData(user.id);
            }
        };
        initialize();
    }, [user, loadUserData]);

    const login = useCallback(async (email: string, password: string) => {
        try {
            setLoading(true);
            await supabaseConnector.login(email, password);
            const loggedInUser = supabaseConnector.currentSession?.user;
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

    const signUp = useCallback(async (email: string, password: string) => {
        try {
            setLoading(true);
            await supabaseConnector.signUp(email, password);
            // Do not login immediately, user must confirm their email first.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign up failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading]);

    const activateLicense = useCallback(async (licenseKey: string) => {
        if (!user) {
            throw new Error('No user is logged in');
        }
        try {
            setLoading(true);
            const response = await supabaseConnector.client.functions.invoke("signUpWithLicense", {
                body: { userId: user.id, licenseKey },
            });

            if (response.error) {
                throw new Error(response.error.message || 'License activation failed');
            }

            // After successful license activation, reload user data
            await loadUserData(user.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'License activation failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [user, setError, setLoading, loadUserData]);

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
        activateLicense,
        setError,
    };
};

export default useAuth;
