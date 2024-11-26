// src/lib/types/data.ts

// File Node Types
export type FileNodeType = 'folder' | 'sampleGroup';

export interface ResearchLocation {
    id: string;
    label: string;
    lat?: number;
    long?: number;
    is_enabled: boolean;
    char_id: string;
}

// Actions specific to locations
export type LocationAction =
    | { type: 'SET_LOCATIONS'; payload: ResearchLocation[] }
    | { type: 'UPDATE_LOCATION'; payload: ResearchLocation }
    | { type: 'UPDATE_LOCATIONS_CACHE'; payload: { timestamp: number; data: ResearchLocation[] } };

// Processing Statuses and Stages
export type ProcessingStatus =
    | 'PENDING'
    | 'COMPRESSING'
    | 'PROCESSING'
    | 'UPLOADING'
    | 'COMPLETED'
    | 'ERROR'
    | 'PAUSED';

export type ProcessingStage =
    | 'INIT'
    | 'FILE_PREP'
    | 'COMPRESSION'
    | 'PROCESSING'
    | 'SAVING'
    | 'CLEANUP'
    | 'DONE';

// Tree Item Interface for UI Components
export interface TreeItem {
    id: string;
    text: string;
    droppable: boolean;
    type: FileNodeType;
    parent_id: string | null;
    children?: TreeItem[];
    // Optional: Include additional data based on type
    sampleGroup?: SampleGroup;
}

// Sample Group Interface
export interface SampleGroup {
    id: string; // Shared with FileNode.id
    name: string;
    human_readable_sample_id: string;
    loc_id: string;
    storage_folder: string;
    collection_date: string;
    collection_datetime_utc?: string;
    user_id: string;
    org_id: string;
    latitude_recorded: number | null;
    longitude_recorded: number | null;
    notes: string | null;
    // Add other fields from sample_group_metadata as needed
}

// Sample Group File Node Interface (Discriminated Union)
export interface SampleGroupFileNode extends FileNodeBase {
    type: 'sampleGroup';
    sampleGroup: SampleGroup;
}

// Folder File Node Interface (Discriminated Union)
export interface FolderFileNode extends FileNodeBase {
    type: 'folder';
    // Additional folder-specific fields if necessary
}

// Base File Node Interface
export interface FileNodeBase {
    id: string;
    org_id: string;
    parent_id?: string;
    name: string;
    type: FileNodeType;
    created_at?: string;
    updated_at?: string;
    version: number;
}

// Union Type for FileNode
export type FileNode = FolderFileNode | SampleGroupFileNode;

// Processing Job Interface
export interface ProcessingJob {
    id: string;
    sampleId: string;
    configId: string;
    status: ProcessingStatus;
    stage: ProcessingStage;
    progress: number;
    functionName: string;
    modalInputs: Record<string, string>;
    files: ProcessingFile[];
    outputPath?: string;
    error?: string;
    createdAt: number;
    updatedAt: number;
    orgId?: string;
    userId?: string;
    processingResult?: any;
    checkpoints: ProcessingCheckpoint[];
}

// Processing File Interface
export interface ProcessingFile {
    path: string;
    name: string;
    size: number;
    status: 'PENDING' | 'COMPRESSED' | 'PROCESSED' | 'ERROR';
    hash: string;
    compressedPath?: string;
}

// Processing Checkpoint Interface
export interface ProcessingCheckpoint {
    stage: ProcessingStage;
    timestamp: number;
    data: any;
}

// Data State Interface
export interface DataState {
    fileTree: TreeItem[];
    sampleGroups: Record<string, SampleGroup>;
    locations: ResearchLocation[];
    processingJobs: Record<string, ProcessingJob>;
    isSyncing: boolean;
    lastSynced: number | null;
    error: string | null;
}

// Pending Operation Interface
export interface PendingOperation {
    id: string;
    type: 'insert' | 'update' | 'delete' | 'upsert';
    table: string;
    data: any;
    timestamp: number;
    sampleId?: string;
    configId?: string;
}

export interface SampleMetadata {
    id: string;
    created_at: string;
    org_id?: string;
    user_id?: string;
    human_readable_sample_id?: string;
    file_name?: string;
    data_type?: string;
    lat?: number,
    long?: number,
    status?: string,
    processed_storage?: string,
    processed_datetime_utc?: string,
    upload_datetime_utc?: string;
    process_function_name?: string;
    sample_group_id?: string;
    raw_storage_paths?: string;
    updated_at?: string | undefined;
}

// Sample Group Metadata Interface
export interface SampleGroupMetadata {
    id: string;
    created_at: string;
    org_id?: string;
    user_id?: string;
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
    sample_group_id?: string;
    raw_storage_paths?: string[];
    collection_date?: string;
    storage_folder?: string;
    collection_datetime_utc?: string;
    loc_id?: string;
    latitude_recorded?: number;
    longitude_recorded?: number;
    notes?: string;
}