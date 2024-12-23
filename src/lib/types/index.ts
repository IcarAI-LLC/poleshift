//src/lib/types/index.ts
import {Factor, UserAppMetadata, UserIdentity, UserMetadata} from "@supabase/supabase-js";

export type PreAuthView = 'login' | 'signup' | 'reset-password';

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

export enum UserRole {
    Admin = 'admin',
    Lead = 'lead',
    Researcher = 'researcher',
    Viewer = 'viewer',
}

export enum Permissions {
    AddUser = 'organizations.add_user',
    RemoveUser = 'organizations.remove_user',
    ViewUser = 'organizations.view_user',
    ModifyUser = 'organizations.modify_user',
    DeleteSampleGroup = 'sample_groups.delete',
    CreateSampleGroup = 'sample_groups.create',
    ModifySampleGroup = 'sample_groups.modify',
    ShareSampleGroup = 'sample_groups.share',
}

export const adminPermissions: Permissions[] = [
    Permissions.AddUser,
    Permissions.RemoveUser,
    Permissions.ViewUser,
    Permissions.ModifyUser,
    Permissions.DeleteSampleGroup,
    Permissions.CreateSampleGroup,
    Permissions.ModifySampleGroup,
    Permissions.ShareSampleGroup
]

export const leadPermissions: Permissions[] = [
    Permissions.AddUser,
    Permissions.RemoveUser,
    Permissions.ViewUser,
    Permissions.ModifyUser,
    Permissions.DeleteSampleGroup,
    Permissions.CreateSampleGroup,
    Permissions.ModifySampleGroup,
    Permissions.ShareSampleGroup
]

export const researcherPermissions: Permissions[] = [
    Permissions.ViewUser,
    Permissions.CreateSampleGroup,
    Permissions.ModifySampleGroup
]

export const viewerPermissions: Permissions[] = []

export interface UserProfile {
    id: string;
    organization_id?: string | null;
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

export enum FileNodeType {
    Folder = 'folder',
    SampleGroup = 'sampleGroup',
}

// Data related types
export interface FileNode {
    id: string;
    org_id: string;
    parent_id?: string | null;
    name: string;
    type: FileNodeType;
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

export enum ProximityCategory {
    Close = 'Immediate',
    Far1 = 'Far1',
    Far2 = 'Far2'
}

export enum TaxonomicRank {
    Root = 'Root',
    Domain = 'Domain',
    Supergroup = 'Supergroup',
    Division = 'Division',
    Subdivision = 'Subdivision',
    Class = 'Class',
    Order = 'Order',
    Family = 'Family',
    Species = 'Species',
    Genus = 'Genus',
    Assembly = 'Assembly',
    Sequence = 'Sequence',
}

/**
 * TypeScript interface describing a single row in the user_settings table.
 */
export interface UserSetting {
    id: number; // Matches real("id") in your schema
    user_id: string; // Matches text("user_id").notNull()
    taxonomic_starburst_max_rank: TaxonomicRank;
    taxonomic_starburst_min_rank: TaxonomicRank;
    globe_datapoint_poles: number;
    globe_datapoint_color: string;
    globe_datapoint_diameter: string;
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
    proximity_category?: ProximityCategory | null;
    excluded: number;
    penguin_count: number | null;
    penguin_present: number;
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