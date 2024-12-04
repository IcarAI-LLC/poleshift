import type {
    User,
    UserProfile,
    Organization,
    SampleGroupMetadata,
    FileNode,
    SampleLocation,
    SampleMetadata,
    ProcessedDataEntry,
    ProcessingQueueItem,
    PendingOperation
} from '../../types';
import type { Session } from '@supabase/supabase-js';

export interface StorageService {
    // Auth storage
    saveSession(session: Session): Promise<void>;
    getSession(): Promise<Session | undefined>;
    removeSession(): Promise<void>;
    saveUser(user: User): Promise<void>;
    getUser(): Promise<User | undefined>;
    removeUser(): Promise<void>;

    // User & Organization storage
    saveUserProfile(profile: UserProfile): Promise<void>;
    getUserProfile(id: string): Promise<UserProfile | undefined>;
    saveOrganization(org: Organization): Promise<void>;
    getOrganization(id: string): Promise<Organization | undefined>;

    // Sample Groups
    saveSampleGroup(group: SampleGroupMetadata): Promise<void>;
    getSampleGroup(id: string): Promise<SampleGroupMetadata | undefined>;
    getSampleGroupsByOrg(orgId: string): Promise<SampleGroupMetadata[]>;
    getAllSampleGroups(): Promise<SampleGroupMetadata[]>;
    deleteSampleGroup(id: string): Promise<void>;

    // File Nodes
    saveFileNode(node: FileNode): Promise<void>;
    getFileNode(id: string): Promise<FileNode | undefined>;
    getFileNodesByOrg(orgId: string): Promise<FileNode[]>;
    deleteFileNode(id: string): Promise<void>;
    getAllFileNodes(): Promise<FileNode[]>;

    // Sample Metadata
    saveSampleMetadata(metadata: SampleMetadata): Promise<void>;
    getSampleMetadata(id: string): Promise<SampleMetadata | undefined>;
    getSampleMetadataBySampleGroupId(sampleGroupId: string): Promise<SampleMetadata[]>;
    deleteSampleMetadata(id: string): Promise<void>;

    // Sample Locations
    saveLocation(location: SampleLocation): Promise<void>;
    getLocation(id: string): Promise<SampleLocation | undefined>;
    getAllLocations(): Promise<SampleLocation[]>;

    // Processed Data
    saveProcessedData(
        sampleId: string,
        configId: string,
        data: any,
        orgShortId: string,
        humanReadableSampleId: string,
        options: {
            rawFilePaths?: string[];
            processedPath?: string;
            metadata?: any;
        }
    ): Promise<void>;
    getProcessedData(sampleId: string, configId: string): Promise<ProcessedDataEntry | null>;
    getAllProcessedData(sampleId: string): Promise<Record<string, ProcessedDataEntry>>;
    deleteProcessedData(sampleId: string, configId: string): Promise<void>;

    // Processing Queue
    queueRawFile(
        sampleId: string,
        configId: string,
        file: File,
        options?: { customPath?: string }
    ): Promise<void>;
    queueProcessedFile(
        sampleId: string,
        configId: string,
        data: Blob,
        options?: { customPath?: string }
    ): Promise<void>;
    getPendingUploads(): Promise<ProcessingQueueItem[]>;
    markUploadComplete(id: string): Promise<void>;
    markUploadError(id: string, error: string): Promise<void>;

    // Sync Operations
    getPendingOperation(id: string): Promise<PendingOperation | undefined>;
    updatePendingOperation(operation: PendingOperation): Promise<void>;
    getPendingOperationsOrderedByTimestamp(): Promise<PendingOperation[]>;
    getAllFailedOperations(maxRetries: number): Promise<PendingOperation[]>;
    deletePendingOperation(id: string): Promise<void>;
    getPendingOperations(): Promise<PendingOperation[]>;
    addPendingOperation(operation: Omit<PendingOperation, 'retryCount'>): Promise<void>;
    incrementOperationRetry(id: string): Promise<void>;
    clearFailedOperations(maxRetries: number): Promise<void>;

    // Store Management
    clearStore<T extends keyof any>(storeName: T): Promise<void>;
    bulkSave<T extends { id: string }>(storeName: string, items: T[]): Promise<void>;
}