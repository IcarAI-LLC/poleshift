import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://poleshift.icarai.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWt3a25ueGN1dWhpd3VuZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg0NTQ0MDMsImV4cCI6MjA0NDAzMDQwM30._qVQAlYoL5jtSVCAKIznQ_5pI73Ke08YzZnoy_50Npg';

// Create Supabase client with enhanced configuration
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        detectSessionInUrl: true,
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-application-name': 'poleshift'
        }
    }
});

// Export type for use in services
export type { SupabaseClient };

// Export configured client
export { supabase };

// Helper function to check if a Supabase error is a network error
export function isSupabaseNetworkError(error: any): boolean {
    return error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('Network request failed') ||
        error?.code === 'NETWORK_ERROR';
}

// Helper function to check if a Supabase error is an authentication error
export function isSupabaseAuthError(error: any): boolean {
    return error?.status === 401 ||
        error?.code === 'PGRST301' ||
        error?.message?.includes('JWT expired');
}

// Helper to handle Supabase errors consistently
export function handleSupabaseError(error: any): Error {
    if (isSupabaseNetworkError(error)) {
        return new Error('Network connection error. Please check your internet connection.');
    }
    if (isSupabaseAuthError(error)) {
        return new Error('Authentication error. Please log in again.');
    }
    return error instanceof Error ? error : new Error(error?.message || 'An unknown error occurred');
}