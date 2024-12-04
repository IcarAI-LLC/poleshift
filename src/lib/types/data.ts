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