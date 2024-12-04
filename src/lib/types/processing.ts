export interface ProgressState {
    progress: number;
    status: string;
}

export interface ProcessedDataEntry {
    key: string;
    human_readable_sample_id: string;
    sample_id: string;
    config_id: string;
    org_short_id: string;
    data: any;
    raw_file_paths: string[];
    processed_path: string | null;
    timestamp: number;
    status: string;
    metadata?: any;
}

export interface ProcessingQueueItem {
    id: string;
    type: 'raw' | 'processed';
    sampleId: string;
    configId: string;
    filePath: string;
    fileBlob: Blob;
    timestamp: number;
    retryCount: number;
    status: 'pending' | 'uploading' | 'error';
    error?: string;
}