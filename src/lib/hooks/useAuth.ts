// lib/hooks/useAuth.ts

import { useContext, useCallback} from 'react';
import { AppContext } from '../contexts/AppContext';
import { AuthAction, User } from "../types";

/**
 * The AuthError interface represents an error related to authentication processes.
 * It contains information about the error that occurred, allowing a client or
 * service to understand and potentially handle the failure.
 *
 * Properties:
 * @property {string} message - A descriptive error message explaining the nature
 * of the authentication error.
 * @property {number} [status] - An optional HTTP status code that might be associated
 * with the error, providing additional context for the type of failure.
 * @property {string} [code] - An optional error code that identifies the specific
 * authentication error, which might be used for programmatically distinguishing
 * between various failure types.
 */
interface AuthError {
    message: string;
    status?: number;
    code?: string;
}

/**
 * Custom hook that provides authentication and user state management functionalities.
 * It integrates with the application's context and auth services to perform operations such as
 * initializing authentication, logging in, signing up, resetting passwords, processing license keys,
 * and logging out. This hook updates the global state accordingly and handles any potential errors in the process.
 *
 * @return {Object} An object containing the user, user profile, organization, loading, and error state,
 * along with the methods initializeAuth, login, signUp, resetPassword, processLicenseKey, and logout for handling auth-related processes.
 */
export function useAuth() {
    const { state, dispatch, services } = useContext(AppContext);
    const { auth: authService } = services;

    const initializeAuth = useCallback(async () => {
        dispatch({ type: 'SET_AUTH_LOADING', payload: true });

        try {
            let session = await authService.getSession();
            let user: User | null = null;

            if (session) {
                user = await authService.getCurrentUser();
            }

            if (!session || !user) {
                // Attempt to get session and user from local storage (offline mode)
                session = await authService.getLocalSession();
                user = await authService.getLocalUser();
            }

            if (!session || !user) {
                dispatch({ type: 'CLEAR_AUTH' });
                return;
            }

            // Update state with user data
            dispatch({ type: 'SET_USER', payload: user });

            const updates: AuthAction[] = [];

            try {
                const userProfile = await authService.getUserProfile(user.id);
                updates.push({ type: 'SET_USER_PROFILE', payload: userProfile });

                if (userProfile.organization_id) {
                    const organization = await authService.getOrganization(userProfile.organization_id);
                    updates.push({ type: 'SET_ORGANIZATION', payload: organization });
                }
            } catch (err) {
                console.error('Failed to load user data:', err);
                await authService.signOut();
                dispatch({ type: 'CLEAR_AUTH' });
                return;
            }

            // Apply all updates
            updates.forEach(update => dispatch(update));

        } catch (err) {
            console.error('Auth initialization error:', err);
            dispatch({
                type: 'SET_AUTH_ERROR',
                payload: err instanceof Error ? err.message : 'Authentication failed'
            });
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
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
        initializeAuth,
        login,
        signUp,
        resetPassword,
        processLicenseKey,
        logout
    };
}
