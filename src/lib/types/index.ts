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
    children?: FileNode[];
    droppable: boolean;
}

export interface SampleGroupMetadata {
    id: string;
    created_at: string;
    org_id?: string | null;
    user_id?: string | null;
    human_readable_sample_id: string;
    collection_date?: string;
    storage_folder?: string;
    collection_datetime_utc?: string;
    loc_id?: string | null;
    latitude_recorded?: number;
    longitude_recorded?: number;
    notes?: string;
    updated_at?: string;
}

export interface SampleLocation {
    id: string;
    label: string;
    lat?: number;
    long?: number;
    is_enabled: boolean;
    char_id: string;
}

export interface SampleMetadata {
    id: string;
    created_at: string;
    org_id?: string | null;
    user_id?: string | null;
    human_readable_sample_id: string;
    file_name?: string;
    file_type?: string;
    data_type?: string;
    lat?: number;
    long?: number;
    status?: string;
    processed_storage_path?: string;
    processed_datetime_utc?: string;
    upload_datetime_utc?: string;
    process_function_name?: string;
    sample_group_id?: string | null;
    raw_storage_paths?: string[] | null;
    updated_at?: string;
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