// lib/api/auth.ts

import { apiClient } from './client';
import { UserProfile, Organization, User, mapSupabaseUser } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthResult {
    user: User | null;
    session: Session | null;
}

export const auth = {
    async login(email: string, password: string): Promise<AuthResult> {
        const { data, error } = await apiClient
            .getClient()
            .auth
            .signInWithPassword({ email, password });

        if (error) throw error;

        return {
            user: data.user ? mapSupabaseUser(data.user) : null,
            session: data.session
        };
    },

    async signup(email: string, password: string): Promise<AuthResult> {
        const { data, error } = await apiClient
            .getClient()
            .auth
            .signUp({ email, password });

        if (error) throw error;

        return {
            user: data.user ? mapSupabaseUser(data.user) : null,
            session: data.session
        };
    },

    async logout(): Promise<void> {
        const { error } = await apiClient
            .getClient()
            .auth
            .signOut();

        if (error) throw error;
    },

    async getUserProfile(userId: string): Promise<UserProfile> {
        const { data, error } = await apiClient
            .getClient()
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('User profile not found');

        return data;
    },

    async getOrganization(orgId: string): Promise<Organization> {
        const { data, error } = await apiClient
            .getClient()
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Organization not found');

        return data;
    }
};