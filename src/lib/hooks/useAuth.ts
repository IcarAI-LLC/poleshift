// lib/hooks/useAuth.ts

import { useCallback } from 'react';
import { useAppState } from '../contexts/AppContext';
import { api } from '../api';
import { mapSupabaseUser } from '../types';

export function useAuth() {
    const { state, dispatch } = useAppState();
    const { auth } = state;

    const login = useCallback(async (email: string, password: string) => {
        dispatch({ type: 'SET_AUTH_LOADING', payload: true });
        try {
            const { session } = await api.auth.login(email, password);
            if (!session?.user) throw new Error('No user returned from login');

            const user = mapSupabaseUser(session.user);
            if (!user) throw new Error('Failed to map user data');

            const userProfile = await api.auth.getUserProfile(user.id);
            const organization = await api.auth.getOrganization(userProfile.organization_id);

            dispatch({ type: 'SET_USER', payload: user });
            dispatch({ type: 'SET_USER_PROFILE', payload: userProfile });
            dispatch({ type: 'SET_ORGANIZATION', payload: organization });

            return { user, userProfile, organization };
        } catch (error: any) {
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [dispatch]);

    const signup = useCallback(async (email: string, password: string) => {
        dispatch({ type: 'SET_AUTH_LOADING', payload: true });
        try {
            const {session} = await api.auth.signup(email, password);
            if (!session?.user) throw new Error('No user returned from signup');

            const user = mapSupabaseUser(session.user);
            if (!user) throw new Error('Failed to map user data');

            dispatch({ type: 'SET_USER', payload: user });
            return user;
        } catch (error: any) {
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [dispatch]);

    const logout = useCallback(async () => {
        dispatch({ type: 'SET_AUTH_LOADING', payload: true });
        try {
            await api.auth.logout();
            dispatch({ type: 'SET_USER', payload: null });
            dispatch({ type: 'SET_USER_PROFILE', payload: null });
            dispatch({ type: 'SET_ORGANIZATION', payload: null });
        } catch (error: any) {
            dispatch({ type: 'SET_AUTH_ERROR', payload: error.message });
            throw error;
        } finally {
            dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        }
    }, [dispatch]);

    return {
        user: auth.user,
        userProfile: auth.userProfile,
        organization: auth.organization,
        loading: auth.loading,
        error: auth.error,
        login,
        signup,
        logout
    };
}