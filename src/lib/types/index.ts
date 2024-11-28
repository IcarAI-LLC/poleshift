//src/lib/types/index.ts
export * from './services.ts'

export interface UserTier {
    name: 'admin' | 'lead' | 'researcher';
}

export interface LicenseKey {
    id: string;
    organization_id?: string | null;
    key: string;
    is_active?: boolean;
    created_at?: string;
}

export interface SampleLocation {
    id: string;
    label: string;
    lat?: number;
    long?: number;
    is_enabled: boolean;
    char_id: string;
}

export interface Organization {
    id: string;
    name: string;
    created_at?: string;
    org_short_id: string;
}

export interface UserProfile {
    id: string;
    organization_id?: string | null;
    user_tier: string;
    created_at?: string;
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

// Auth Types
export interface User {
    id: string;
    email: string;
    last_sign_in_at: string | null;
}

// UI State Types
export interface ModalState {
    isOpen: boolean;
    title: string;
    type: 'input' | 'data';
    configItem?: any;
    modalInputs?: Record<string, string>;
    data?: any;
}

export interface ContextMenuState {
    isVisible: boolean;
    x: number;
    y: number;
    itemId: string | null;
}

export interface UIState {
    selectedLeftItem: FileNode | null;
    selectedRightItem: SampleLocation | null;
    isSidebarCollapsed: boolean;
    isRightSidebarCollapsed: boolean;
    showAccountActions: boolean;
    errorMessage: string;
    filters: {
        startDate: string | null;
        endDate: string | null;
        selectedLocations: string[];
    };
    modal: ModalState;
    contextMenu: ContextMenuState;
}

// Processed Data Types
export interface ProgressState {
    progress: number;
    status: string;
}

export interface ProcessedDataState {
    data: Record<string, any>;
    isProcessing: Record<string, boolean>;
    error: string | null;
    processedData: Record<string, any>;
    progressStates: Record<string, any>;
    uploadDownloadProgressStates: Record<string, any>;
}


// Context State Types
export interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    loading: boolean;
    error: string | null;  // Make sure this exists
}

export interface DataState {
    fileTree: FileNode[];
    sampleGroups: Record<string, SampleGroupMetadata>;
    locations: SampleLocation[];
    isSyncing: boolean;
    lastSynced: number | null;
    error: string | null;
}

// Error Types
export class AppError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'AppError';
    }
}

export class StorageError extends AppError {
    constructor(message: string, originalError?: any) {
        super(message, originalError);
        this.name = 'StorageError';
    }
}

export class SyncError extends AppError {
    constructor(message: string, originalError?: any) {
        super(message, originalError);
        this.name = 'SyncError';
    }
}

export interface PendingOperation {
    id: string;
    type: 'create' | 'update' | 'delete';
    table: string;
    data: any;
    timestamp: number;
    retryCount: number;  // Add this field
}

// Action Types
export type LocationAction =
    | { type: 'SET_LOCATIONS'; payload: SampleLocation[] }
    | { type: 'UPDATE_LOCATION'; payload: SampleLocation }
    | { type: 'UPDATE_LOCATIONS_CACHE'; payload: { timestamp: number; data: SampleLocation[] } };

export type AuthAction =
    | { type: 'SET_USER'; payload: User | null }
    | { type: 'SET_USER_PROFILE'; payload: UserProfile | null }
    | { type: 'SET_ORGANIZATION'; payload: Organization | null }
    | { type: 'SET_AUTH_LOADING'; payload: boolean }
    | { type: 'SET_AUTH_ERROR'; payload: string | null }
    | { type: 'CLEAR_AUTH' }; // Added this new action

export type DataAction =
    | { type: 'SET_FILE_TREE'; payload: FileNode[] }
    | { type: 'SET_SAMPLE_GROUPS'; payload: Record<string, SampleGroupMetadata> }
    | { type: 'ADD_SAMPLE_GROUP'; payload: SampleGroupMetadata }
    | { type: 'UPDATE_SAMPLE_GROUP'; payload: SampleGroupMetadata }
    | { type: 'DELETE_SAMPLE_GROUP'; payload: string }
    | { type: 'SET_LOCATIONS'; payload: SampleLocation[] }
    | { type: 'SET_SYNCING'; payload: boolean }
    | { type: 'SET_LAST_SYNCED'; payload: number }
    | { type: 'SET_DATA_ERROR'; payload: string | null };

export type UIAction =
    | { type: 'SET_SELECTED_LEFT_ITEM'; payload: FileNode | null }
    | { type: 'SET_SELECTED_RIGHT_ITEM'; payload: SampleLocation | null }
    | { type: 'TOGGLE_SIDEBAR'; payload?: boolean }
    | { type: 'TOGGLE_RIGHT_SIDEBAR'; payload?: boolean }
    | { type: 'SET_SHOW_ACCOUNT_ACTIONS'; payload: boolean }
    | { type: 'SET_ERROR_MESSAGE'; payload: string }
    | { type: 'SET_FILTERS'; payload: UIState['filters'] }
    | { type: 'SET_MODAL_STATE'; payload: ModalState }
    | { type: 'SET_CONTEXT_MENU_STATE'; payload: ContextMenuState };

export type ProcessedDataAction =
    | { type: 'SET_PROCESSED_DATA'; payload: { key: string; data: any } }
    | { type: 'SET_PROCESSING_STATUS'; payload: { key: string; status: boolean } }
    | { type: 'SET_PROCESSED_DATA_ERROR'; payload: string | null }
    | { type: 'SET_PROCESSED_DATA_PROGRESS'; payload: { key: string; status: string; progress: number } }
    | { type: 'SET_UPLOAD_DOWNLOAD_PROGRESS'; payload: { key: string; status: string; progress: number } };

// Combined Action Type
export type AppAction =
    | AuthAction
    | DataAction
    | UIAction
    | ProcessedDataAction;

// Update ProcessedDataState type
export interface ProcessedDataState {
    data: Record<string, any>;
    isProcessing: Record<string, boolean>;
    error: string | null;
}

export interface ProcessedDataEntry {
    key?: string; // Used internally by IndexedDB
    sampleId: string;
    configId: string;
    data: any;
    rawFilePaths: string[];
    processedPath: string | null;
    timestamp: number;
    status: 'pending' | 'processing' | 'processed' | 'error';
    error?: string;
    metadata?: {
        processFunction: string;
        processedDateTime: string;
    };
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

export interface ProcessedDataStorage {
    // Core processed data operations
    saveProcessedData(
        sampleId: string,
        configId: string,
        data: any,
        options?: {
            rawFilePaths?: string[];
            processedPath?: string;
            metadata?: ProcessedDataEntry['metadata'];
        }
    ): Promise<void>;

    getProcessedData(sampleId: string, configId: string): Promise<ProcessedDataEntry | null>;
    getAllProcessedData(sampleId: string): Promise<Record<string, ProcessedDataEntry>>;
    deleteProcessedData(sampleId: string, configId: string): Promise<void>;

    // Queue operations for files
    queueRawFile(
        sampleId: string,
        configId: string,
        file: File,
        options?: {
            customPath?: string
        }
    ): Promise<void>;

    queueProcessedFile(
        sampleId: string,
        configId: string,
        data: Blob,
        options?: {
            customPath?: string
        }
    ): Promise<void>;

    getPendingUploads(): Promise<ProcessingQueueItem[]>;
    markUploadComplete(id: string): Promise<void>;
    markUploadError(id: string, error: string): Promise<void>;
}

// Update AppState to include ProcessedDataState
export interface AppState {
    auth: AuthState;
    data: DataState;
    processedData: ProcessedDataState;
    ui: UIState;
}