export type PreAuthView = {
    view: 'login' | 'signup' | 'reset-password';
};

export interface UserTier {
    name: 'admin' | 'lead' | 'researcher';
}

export interface User {
    id: string;
    email: string;
    last_sign_in_at: string | null;
}

export interface UserProfile {
    id: string;
    organization_id?: string | null;
    user_tier: string;
    created_at?: string;
}

export interface Organization {
    id: string;
    name: string;
    created_at?: string;
    org_short_id: string;
}

export interface LicenseKey {
    id: string;
    organization_id?: string | null;
    key: string;
    is_active?: boolean;
    created_at?: string;
}