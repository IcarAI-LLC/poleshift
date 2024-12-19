import { useAuthStore } from '../stores/authStore';
import { supabaseConnector } from '../powersync/SupabaseConnector';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import { usePowerSync } from "@powersync/react";
import {Organization, UserProfile} from "../types";

const WAIT_TIME_MS = 240000; // 240 seconds
const POLL_INTERVAL_MS = 2000; // 2 seconds

export const useAuth = () => {
    const {
        user, userProfile, organization, error, loading,
        setError, setLoading, setUser, setUserProfile, setOrganization
    } = useAuthStore();
    const db = usePowerSync()
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const didTimeoutRef = useRef<boolean>(false);
    console.log('Auth rerender');
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
            // console.error('Failed to load user data:', err);
            // setError('Here!');
        }
    }, [setUserProfile, setOrganization, setError]);

    // Attempt to load user data if user is set
    useEffect(() => {
        const initialize = async () => {
            if (user && !userProfile) {
                // If userProfile not loaded yet, we start polling below
                startUserProfilePolling(user.id);
            }
        };
        initialize();

        // Cleanup polling on unmount or if conditions change
        return () => {
            cleanupPolling();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const startUserProfilePolling = (userId: string) => {
        cleanupPolling();

        didTimeoutRef.current = false;

        // Start a 20-second timer
        timeoutRef.current = setTimeout(() => {
            didTimeoutRef.current = true;
            cleanupPolling();
            // No profile after 20 seconds:
            // We'll rely on derived states below
        }, WAIT_TIME_MS);

        // Poll every 2 seconds
        intervalRef.current = setInterval(async () => {
            if (didTimeoutRef.current) return;
            try {
                const profile = await fetchUserProfile(userId);
                if (profile) {
                    setUserProfile(profile);
                    if (profile.organization_id) {
                        const org = await fetchOrganization(profile.organization_id);
                        setOrganization(org);
                    } else {
                        setOrganization(null);
                    }
                    // If we found the profile, stop polling
                    cleanupPolling();
                }
            } catch (err) {
                console.error('Failed to load user data:', err);
                // setError('Failed to load user data');
            }
        }, POLL_INTERVAL_MS);
    };

    const cleanupPolling = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        intervalRef.current = null;
        timeoutRef.current = null;
    };

    const login = useCallback(async (email: string, password: string) => {
        try {
            setLoading(true);
            await supabaseConnector.login(email, password);
            if (!db.connected) {
                await db.connect(supabaseConnector);
            }
            const { data } = await supabaseConnector.client.auth.getSession();

            const loggedInUser = data.session?.user;
            setUser(loggedInUser || null);

            if (loggedInUser) {
                // Attempt initial load of user data
                await loadUserData(loggedInUser.id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading, setUser, loadUserData]);

    /**
     * Fetches the user profile for a given user ID.
     * @param userId - The UUID of the user.
     * @returns The user profile or null if not found.
     */
    const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
        const result = await db.get(
            `
            SELECT * FROM user_profiles
            WHERE id = ?
            LIMIT 1
        `,
            [userId]
        );
        return result as UserProfile | null;
    };

    /**
     * Fetches the organization details for a given organization ID.
     * @param orgId - The UUID of the organization.
     * @returns The organization details or null if not found.
     */
    const fetchOrganization = async (orgId: string): Promise<Organization | null> => {
        const result = await db.get(
            `
            SELECT * FROM organizations
            WHERE id = ?
            LIMIT 1
        `,
            [orgId]
        );
        return result as Organization | null;
    };

    const signUp = useCallback(async (email: string, password: string) => {
        try {
            setLoading(true);
            await supabaseConnector.signUp(email, password);
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
                body: {userId: user.id, licenseKey},
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
            setUser(null);
            setUserProfile(null);
            setOrganization(null);
            await supabaseConnector.logout();
            await db.disconnectAndClear();
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

    const resetApp = () => {
        try {
            setUser(null);
            setUserProfile(null);
            setOrganization(null);
            localStorage.clear();
            db.disconnectAndClear();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Reset failed');
            throw err;
        } finally {
            setLoading(false);
        }
    };

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

    // Derived states
    const profileLoading = isAuthenticated && !userProfile && !didTimeoutRef.current;
    const profileFetchTimedOut = isAuthenticated && !userProfile && didTimeoutRef.current;

    return useMemo(() => ({
        user,
        userProfile,
        organization,
        error,
        loading,
        isAuthenticated,
        login,
        signUp,
        logout,
        resetApp,
        resetPassword,
        activateLicense,
        setError,
        profileLoading,
        profileFetchTimedOut,
    }), [
        user,
        userProfile,
        organization,
        error,
        loading,
        isAuthenticated,
        login,
        signUp,
        logout,
        resetApp,
        resetPassword,
        activateLicense,
        setError,
        profileLoading,
        profileFetchTimedOut,
    ]);
}