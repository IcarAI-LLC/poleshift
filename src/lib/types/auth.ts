// lib/types/auth.ts

import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
    id: string;
    email: string;
    last_sign_in_at: string | null;
}

export interface UserProfile {
    id: string;
    user_tier: 'admin' | 'lead' | 'researcher';
    organization_id: string;
}

export interface Organization {
    id: string;
    name: string;
    org_short_id: string;
}

export interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    loading: boolean;
    error: string | null;
}

export function mapSupabaseUser(supabaseUser: SupabaseUser | undefined | null): User | null {
    if (!supabaseUser?.email) return null;

    return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        last_sign_in_at: supabaseUser.last_sign_in_at || null
    };
}