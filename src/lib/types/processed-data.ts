
// Progress tracking types
import {SampleGroup} from "./data.ts";
import {DropboxConfigItem} from "../../config/dropboxConfig.ts";

export interface ProgressState {
    progress: number;
    status: string;
}

export interface UploadDownloadProgressState {
    progress: number;
    status: string;
}

// Main state interface
export interface ProcessedDataState {
    processedData: Record<string, any>;
    isProcessing: Record<string, boolean>;
    progressStates: Record<string, ProgressState>;
    uploadDownloadProgressStates: Record<string, UploadDownloadProgressState>;
}

// Action types
export type ProcessedDataAction =
    | { type: 'SET_PROCESSING_STATE'; sampleId: string; configId: string; isProcessing: boolean }
    | { type: 'UPDATE_PROCESSED_DATA'; sampleId: string; configId: string; data: any }
    | { type: 'UPDATE_PROGRESS_STATE'; sampleId: string; configId: string; progress: number; status: string }
    | { type: 'UPDATE_UPLOAD_DOWNLOAD_PROGRESS_STATE'; sampleId: string; configId: string; progress: number; status: string }
    | { type: 'SET_PROCESSED_DATA'; data: Record<string, any> };

// Context interface
export interface ProcessedDataContextType {
    processedData: Record<string, any>;
    isProcessing: Record<string, boolean>;
    progressStates: Record<string, ProgressState>;
    uploadDownloadProgressStates: Record<string, UploadDownloadProgressState>;
    processData: (
        functionName: string,
        sampleGroup: SampleGroup, // This import needs to be added
        modalInputs: Record<string, string>,
        uploadedFiles: File[],
        configItem: DropboxConfigItem, // This import needs to be added
        onDataProcessed: (insertData: any, configItem: DropboxConfigItem, processedData: any) => void,
        onError: (message: string) => void,
        onProgress?: (progress: number, status: string) => void,
    ) => Promise<void>;
    setProcessingState: (sampleId: string, configId: string, isProcessing: boolean) => void;
    updateProcessedData: (sampleId: string, configId: string, data: any) => void;
    fetchProcessedData: (sampleGroup: SampleGroup | null) => Promise<void>;
    updateProgressState: (sampleId: string, configId: string, progress: number, status: string) => void;
    getProgressState: (sampleId: string, configId: string) => ProgressState;
    updateUploadDownloadProgressState: (sampleId: string, configId: string, progress: number, status: string) => void;
    getUploadDownloadProgressState: (sampleId: string, configId: string) => UploadDownloadProgressState;
}