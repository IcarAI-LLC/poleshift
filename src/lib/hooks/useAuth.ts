// lib/hooks/useAuth.ts
import { useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
//@ts-ignore
import {storage} from "../storage/IndexedDB.ts";
import {supabase} from "../supabase/client.ts";

export function useAuth() {
    const { state, dispatch, services } = useContext(AppContext);
    const { auth: authService } = services;

    const login = useCallback(async (email: string, password: string) => {
        try {
            await authService.signIn(email, password);
            const session = await supabase.getSession();
            if (session) {
                const userProfile = await storage.getUserProfile(session.user.id);
                //@ts-ignore
                dispatch({ type: 'SET_USER', payload: session.user });
                //@ts-ignore
                dispatch({ type: 'SET_USER_PROFILE', payload: userProfile });
            }
        } catch (error) {
            throw error;
        }
    }, [authService, dispatch]);

    const logout = useCallback(async () => {
        try {
            await authService.signOut();
            dispatch({ type: 'SET_USER', payload: null });
            dispatch({ type: 'SET_USER_PROFILE', payload: null });
        } catch (error) {
            throw error;
        }
    }, [authService, dispatch]);

    return {
        user: state.auth.user,
        userProfile: state.auth.userProfile,
        organization: state.auth.organization,
        loading: state.auth.loading,
        login,
        logout
    };
}