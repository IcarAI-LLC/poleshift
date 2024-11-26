// lib/types/auth.ts

import type { User as SupabaseUser } from '@supabase/supabase-js';

// Define the possible user tiers based on the `user_tiers` table
export type UserTier = 'admin' | 'lead' | 'researcher';

// Interface representing a User
export interface User {
    id: string;
    email: string;
    last_sign_in_at: string | null;
}

export interface LicenseProcessResult {
    success: boolean;
    error?: string;
}

// User Tier Record Interface
export interface UserTierRecord {
    name: UserTier;
}

// License Key Interface
export interface LicenseKey {
    id: string;
    organization_id?: string;
    key: string;
    is_active?: boolean;
    created_at?: string;
}

// User Profile Record Interface
export interface UserProfileRecord {
    id: string;
    organization_id?: string;
    user_tier: UserTier;
    created_at?: string;
}


// Interface representing a User Profile
export interface UserProfile {
    id: string;
    user_tier: UserTier;
    organization_id?: string; // Made optional as `organization_id` can be null
    created_at?: string | null;
}

// Interface representing an Organization
export interface Organization {
    id: string;
    name: string;
    org_short_id: string;
    created_at?: string | null;
}

// Interface representing the authentication state
export interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    loading: boolean;
    error: string | null;
}

// Utility function to map SupabaseUser to your User interface
export function mapSupabaseUser(supabaseUser: SupabaseUser | undefined | null): User | null {
    if (!supabaseUser?.email) return null;

    return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        last_sign_in_at: supabaseUser.last_sign_in_at || null
    };
}
