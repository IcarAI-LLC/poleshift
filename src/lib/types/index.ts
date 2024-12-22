//src/lib/types/index.ts
import {Factor, UserAppMetadata, UserIdentity, UserMetadata} from "@supabase/supabase-js";

export type PreAuthView = 'login' | 'signup' | 'reset-password';

export interface UserTier {
    name: 'admin' | 'lead' | 'researcher';
}

export interface User {
    id: string
    app_metadata: UserAppMetadata
    user_metadata: UserMetadata
    aud: string
    confirmation_sent_at?: string
    recovery_sent_at?: string
    email_change_sent_at?: string
    new_email?: string
    new_phone?: string
    invited_at?: string
    action_link?: string
    email?: string
    phone?: string
    created_at: string
    confirmed_at?: string
    email_confirmed_at?: string
    phone_confirmed_at?: string
    last_sign_in_at?: string
    role?: string
    updated_at?: string
    identities?: UserIdentity[]
    is_anonymous?: boolean
    factors?: Factor[]
}

export interface UserProfile {
    id: string;
    organization_id?: string | null;
    user_tier: string;
    user_role: string;
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

// Data related types
export interface FileNode {
    id: string;
    org_id: string;
    parent_id?: string | null;
    name: string;
    type: string;
    created_at?: string;
    updated_at?: string;
    version: number;
    sample_group_id?: string | null;
    droppable: number;
    /**
     * This property is not stored in the DB, but is used
     * for building the tree structure in-memory for MUI.
     */
    children?: FileNode[];
}

export interface SampleGroupMetadata {
    id: string;
    created_at: string;
    org_id?: string | null;
    user_id?: string | null;
    human_readable_sample_id: string;
    collection_date: string;
    storage_folder: string;
    collection_datetime_utc?: string | null;
    loc_id: string;
    latitude_recorded?: number | null;
    longitude_recorded?: number | null;
    notes: string | null;
    updated_at: string;
}

export interface SampleLocation {
    id: string;
    label: string;
    lat: number;
    long: number;
    is_enabled: number;
    char_id: string;
}

// UI related types
export interface ModalState {
    isOpen: boolean;
    title: string;
    type: 'input' | 'data';
    configItem?: any;
    modalInputs?: Record<string, string>;
    data?: any;
}