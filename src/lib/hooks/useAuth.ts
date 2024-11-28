// lib/hooks/useAuth.ts
import { useContext, useCallback, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';

interface AuthError {
    message: string;
    status?: number;
    code?: string;
}

export function useAuth() {
    const { state, dispatch, services } = useContext(AppContext);
    const { auth: authService } = services;

    // Auth initialization effect
    useEffect(() => {
        let isMounted = true;

        const initAuth = async () => {
            try {
                if (!isMounted) return;
                dispatch({ type: 'SET_AUTH_LOADING', payload: true });

                // Get session
                const session = await authService.getSession();

                // If no session, clear auth state and return
                if (!session) {
                    dispatch({ type: 'CLEAR_AUTH' });
                    return;
                }

                // Get current user
                const user = await authService.getCurrentUser();
                if (!user) {
                    dispatch({ type: 'CLEAR_AUTH' });
                    return;
                }

                // Set user in state
                dispatch({ type: 'SET_USER', payload: user });

                try {
                    // Get user profile
                    const userProfile = await authService.getUserProfile(user.id);
                    dispatch({ type: 'SET_USER_PROFILE', payload: userProfile });

                    // Get organization if available
                    if (userProfile.organization_id) {
                        const organization = await authService.getOrganization(userProfile.organization_id);
                        dispatch({ type: 'SET_ORGANIZATION', payload: organization });
                    }
                } catch (err) {
                    console.error('Failed to load user data:', err);
                    // If we fail to get profile/org info, log out
                    await authService.signOut();
                    dispatch({ type: 'CLEAR_AUTH' });
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
                dispatch({
                    type: 'SET_AUTH_ERROR',
                    payload: err instanceof Error ? err.message : 'Authentication failed'
                });
            } finally {
                if (isMounted) {
                    dispatch({ type: 'SET_AUTH_LOADING', payload: false });
                }
            }
        };

        initAuth();

        // Cleanup function
        return () => {
            isMounted = false;
        };
    }, [authService, dispatch]);

    const login = useCallback(async (email: string, password: string) => {
        try {
            dispatch({ type: 'SET_AUTH_LOADING', payload: true });
            dispatch({ type: 'SET_AUTH_ERROR', payload: null });

            const { user, profile, organization, storedLicenseKey } = await authService.signIn(email, password);

            dispatch({ type: 'SET_USER', payload: user });
            dispatch({ type: 'SET_USER_PROFILE', payload: profile });
            if (organization) {
                dispatch({ type: 'SET_ORGANIZATION', payload: organization });
            }

            return { storedLicenseKey };
        } catch (err) {
            const error = err as Error | AuthError;
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message || 'Login failed' });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [authService, dispatch]);

    const signUp = useCallback(async (email: string, password: string, licenseKey: string) => {
        try {
            dispatch({ type: 'SET_AUTH_LOADING', payload: true });
            dispatch({ type: 'SET_AUTH_ERROR', payload: null });

            await authService.signUp(email, password, licenseKey);
        } catch (err) {
            const error = err as Error | AuthError;
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message || 'Sign up failed' });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [authService, dispatch]);

    const resetPassword = useCallback(async (email: string) => {
        try {
            dispatch({ type: 'SET_AUTH_LOADING', payload: true });
            dispatch({ type: 'SET_AUTH_ERROR', payload: null });

            await authService.resetPassword(email);
        } catch (err) {
            const error = err as Error | AuthError;
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message || 'Password reset failed' });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [authService, dispatch]);

    const processLicenseKey = useCallback(async (licenseKey: string) => {
        try {
            dispatch({ type: 'SET_AUTH_LOADING', payload: true });
            dispatch({ type: 'SET_AUTH_ERROR', payload: null });

            await authService.processLicenseKey(licenseKey);
        } catch (err) {
            const error = err as Error | AuthError;
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message || 'License key processing failed' });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [authService, dispatch]);

    const logout = useCallback(async () => {
        try {
            dispatch({ type: 'SET_AUTH_LOADING', payload: true });
            dispatch({ type: 'SET_AUTH_ERROR', payload: null });

            await authService.signOut();
            dispatch({ type: 'CLEAR_AUTH' });
        } catch (err) {
            const error = err as Error | AuthError;
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message || 'Logout failed' });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [authService, dispatch]);

    return {
        user: state.auth.user,
        userProfile: state.auth.userProfile,
        organization: state.auth.organization,
        loading: state.auth.loading,
        error: state.auth.error,
        login,
        signUp,
        resetPassword,
        processLicenseKey,
        logout
    };
}