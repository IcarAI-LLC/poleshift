// lib/api/auth.ts

import { apiClient } from './client';
import { UserProfile, Organization, User, mapSupabaseUser, LicenseProcessResult } from '../types';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

interface AuthResult {
    user: User | null;
    session: Session | null;
}

interface AuthStateListener {
    subscription: {
        unsubscribe: () => void;
    };
}

type AuthStateCallback = (session: Session | null) => void;

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
    },

    // New methods to support AuthContext
    async getSession(): Promise<Session | null> {
        const { data: { session }, error } = await apiClient
            .getClient()
            .auth
            .getSession();

        if (error) throw error;
        return session;
    },

    onAuthStateChange(callback: AuthStateCallback): AuthStateListener {
        const { data: authListener } = apiClient
            .getClient()
            .auth
            .onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
                callback(session);
            });

        return authListener;
    },

    // Methods for managing local storage
    persistSession(session: Session): void {
        window.localStorage.setItem('supabaseSession', JSON.stringify(session));
    },

    clearPersistedSession(): void {
        window.localStorage.removeItem('supabaseSession');
        window.localStorage.removeItem('userDetails');
    },

    getPersistedSession(): Session | null {
        const sessionStr = window.localStorage.getItem('supabaseSession');
        return sessionStr ? JSON.parse(sessionStr) : null;
    },

    async processLicense(licenseKey: string): Promise<LicenseProcessResult> {
        const { data: { session }, error: sessionError } = await apiClient
            .getClient()
            .auth
            .getSession();

        if (sessionError) throw sessionError;

        const accessToken = session?.access_token;
        if (!accessToken) {
            throw new Error('User is not authenticated.');
        }

        const response = await fetch(
            'https://poleshift.icarai.cloud/functions/v1/process_license',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ licenseKey }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error processing license key.');
        }

        return { success: true };
    },

    clearStoredLicense(): void {
        window.localStorage.removeItem('licenseKey');
    },

    getStoredLicense(): string | null {
        return window.localStorage.getItem('licenseKey');
    },
    async resetPassword(email: string): Promise<void> {
        const { error } = await apiClient
            .getClient()
            .auth
            .resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });

        if (error) throw error;
    },

    async signUpWithLicense(email: string, password: string, licenseKey: string): Promise<void> {
        const { error: signUpError } = await apiClient
            .getClient()
            .auth
            .signUp({ email, password });

        if (signUpError) throw signUpError;

        // Store license key for processing after email confirmation
        window.localStorage.setItem('licenseKey', licenseKey);
    },

    storeLicenseKey(licenseKey: string): void {
        window.localStorage.setItem('licenseKey', licenseKey);
    }
};