// src/lib/types/data.ts
import { Location } from './location';

export interface TreeItem {
    id: string;
    text: string;
    droppable: boolean;
    type: 'folder' | 'sampleGroup';
    parent_id: string | null;
    children?: TreeItem[];
}

export interface SampleGroup {
    id: string;
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
}

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

export interface ProcessingFile {
    path: string;
    name: string;
    size: number;
    status: 'PENDING' | 'COMPRESSED' | 'PROCESSED' | 'ERROR';
    hash: string;
    compressedPath?: string;
}

export interface ProcessingCheckpoint {
    stage: ProcessingStage;
    timestamp: number;
    data: any;
}

export interface DataState {
    fileTree: TreeItem[];
    sampleGroups: Record<string, SampleGroup>;
    locations: Location[];
    processingJobs: Record<string, ProcessingJob>;
    isSyncing: boolean;
    lastSynced: number | null;
    error: string | null;
}

export interface PendingOperation {
    id: string;
    type: 'insert' | 'update' | 'delete' | 'upsert';
    table: string;
    data: any;
    timestamp: number;
}

export * from './location';
