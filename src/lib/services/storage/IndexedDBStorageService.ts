import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
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
import type { StorageService } from './StorageService';
import type { Session } from '@supabase/supabase-js';

interface AppDB extends DBSchema {
    users: {
        key: string;
        value: User;
    };
    sessions: {
        key: string;
        value: Session;
    };
    user_profiles: {
        key: string;
        value: UserProfile;
        indexes: { 'organization_id': string };
    };
    organizations: {
        key: string;
        value: Organization;
    };
    sample_group_metadata: {
        key: string;
        value: SampleGroupMetadata;
        indexes: {
            'org_id': string;
            'user_id': string;
            'loc_id': string;
            'human_readable_sample_id': string;
        };
    };
    file_nodes: {
        key: string;
        value: FileNode;
        indexes: {
            'org_id': string;
            'sample_group_id': string;
            'parent_id': string;
        };
    };
    sample_metadata: {
        key: string;
        value: SampleMetadata;
        indexes: {
            'sample_group_id': string;
            'org_id': string;
            'user_id': string;
            'human_readable_sample_id': string;
        };
    };
    sample_locations: {
        key: string;
        value: SampleLocation;
    };
    processed_data: {
        key: string;
        value: ProcessedDataEntry;
        indexes: {
            'human_readable_sample_id': string;
            'sample_id': string;
            'timestamp': number;
            'status': string;
        };
    };
    processing_queue: {
        key: string;
        value: ProcessingQueueItem;
        indexes: {
            'status': string;
            'timestamp': number;
            'type': string;
        };
    };
    pending_operations: {
        key: string;
        value: PendingOperation;
        indexes: { 'timestamp': number };
    };
}

export class IndexedDBStorageService implements StorageService {
    private db: IDBPDatabase<AppDB> | null = null;
    private static instance: IndexedDBStorageService;

    private constructor() {}

    public static getInstance(): IndexedDBStorageService {
        if (!IndexedDBStorageService.instance) {
            IndexedDBStorageService.instance = new IndexedDBStorageService();
        }
        return IndexedDBStorageService.instance;
    }

    private async getDB(): Promise<IDBPDatabase<AppDB>> {
        if (!this.db) {
            this.db = await openDB<AppDB>('appDB', 1, {
                upgrade(db) {
                    // Create object stores and indexes
                    if (!db.objectStoreNames.contains('users')) {
                        db.createObjectStore('users');
                    }

                    if (!db.objectStoreNames.contains('sessions')) {
                        db.createObjectStore('sessions');
                    }

                    if (!db.objectStoreNames.contains('user_profiles')) {
                        const userProfileStore = db.createObjectStore('user_profiles', { keyPath: 'id' });
                        userProfileStore.createIndex('organization_id', 'organization_id');
                    }

                    if (!db.objectStoreNames.contains('organizations')) {
                        db.createObjectStore('organizations', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('sample_group_metadata')) {
                        const sampleGroupStore = db.createObjectStore('sample_group_metadata', { keyPath: 'id' });
                        sampleGroupStore.createIndex('org_id', 'org_id');
                        sampleGroupStore.createIndex('user_id', 'user_id');
                        sampleGroupStore.createIndex('loc_id', 'loc_id');
                        sampleGroupStore.createIndex('human_readable_sample_id', 'human_readable_sample_id', { unique: true });
                    }

                    if (!db.objectStoreNames.contains('file_nodes')) {
                        const fileNodeStore = db.createObjectStore('file_nodes', { keyPath: 'id' });
                        fileNodeStore.createIndex('org_id', 'org_id');
                        fileNodeStore.createIndex('sample_group_id', 'sample_group_id');
                        fileNodeStore.createIndex('parent_id', 'parent_id');
                    }

                    if (!db.objectStoreNames.contains('sample_metadata')) {
                        const sampleMetaStore = db.createObjectStore('sample_metadata', { keyPath: 'id' });
                        sampleMetaStore.createIndex('sample_group_id', 'sample_group_id');
                        sampleMetaStore.createIndex('org_id', 'org_id');
                        sampleMetaStore.createIndex('user_id', 'user_id');
                        sampleMetaStore.createIndex('human_readable_sample_id', 'human_readable_sample_id');
                    }

                    if (!db.objectStoreNames.contains('sample_locations')) {
                        db.createObjectStore('sample_locations', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('processed_data')) {
                        const processedDataStore = db.createObjectStore('processed_data', { keyPath: 'key' });
                        processedDataStore.createIndex('human_readable_sample_id', 'human_readable_sample_id');
                        processedDataStore.createIndex('sample_id', 'sample_id');
                        processedDataStore.createIndex('timestamp', 'timestamp');
                        processedDataStore.createIndex('status', 'status');
                    }

                    if (!db.objectStoreNames.contains('processing_queue')) {
                        const queueStore = db.createObjectStore('processing_queue', { keyPath: 'id' });
                        queueStore.createIndex('status', 'status');
                        queueStore.createIndex('timestamp', 'timestamp');
                        queueStore.createIndex('type', 'type');
                    }

                    if (!db.objectStoreNames.contains('pending_operations')) {
                        const pendingStore = db.createObjectStore('pending_operations', { keyPath: 'id' });
                        pendingStore.createIndex('timestamp', 'timestamp');
                    }
                }
            });
        }
        return this.db;
    }

    // Auth-related methods
    async saveSession(session: Session): Promise<void> {
        const db = await this.getDB();
        await db.put('sessions', session, 'current');
    }

    async getSession(): Promise<Session | undefined> {
        const db = await this.getDB();
        return db.get('sessions', 'current');
    }

    async removeSession(): Promise<void> {
        const db = await this.getDB();
        await db.delete('sessions', 'current');
    }

    async saveUser(user: User): Promise<void> {
        const db = await this.getDB();
        await db.put('users', user, 'current');
    }

    async getUser(): Promise<User | undefined> {
        const db = await this.getDB();
        return db.get('users', 'current');
    }

    async removeUser(): Promise<void> {
        const db = await this.getDB();
        await db.delete('users', 'current');
    }

    // User Profile and Organization methods
    async saveUserProfile(profile: UserProfile): Promise<void> {
        const db = await this.getDB();
        await db.put('user_profiles', profile);
    }

    async getUserProfile(id: string): Promise<UserProfile | undefined> {
        const db = await this.getDB();
        return db.get('user_profiles', id);
    }

    async saveOrganization(org: Organization): Promise<void> {
        const db = await this.getDB();
        await db.put('organizations', org);
    }

    async getOrganization(id: string): Promise<Organization | undefined> {
        const db = await this.getDB();
        return db.get('organizations', id);
    }

    // Sample Group methods
    async saveSampleGroup(group: SampleGroupMetadata): Promise<void> {
        const db = await this.getDB();
        await db.put('sample_group_metadata', group);
    }

    async getSampleGroup(id: string): Promise<SampleGroupMetadata | undefined> {
        const db = await this.getDB();
        return db.get('sample_group_metadata', id);
    }

    async getSampleGroupsByOrg(orgId: string): Promise<SampleGroupMetadata[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('sample_group_metadata', 'org_id', orgId);
    }

    async getAllSampleGroups(): Promise<SampleGroupMetadata[]> {
        const db = await this.getDB();
        return db.getAll('sample_group_metadata');
    }

    async deleteSampleGroup(id: string): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(
            ['sample_group_metadata', 'sample_metadata', 'processed_data', 'file_nodes'],
            'readwrite'
        );

        // Delete the sample group
        await tx.objectStore('sample_group_metadata').delete(id);

        // Delete associated sample metadata
        const sampleMetadataStore = tx.objectStore('sample_metadata');
        const sampleMetadataIndex = sampleMetadataStore.index('sample_group_id');
        const sampleMetadataToDelete = await sampleMetadataIndex.getAllKeys(id);
        await Promise.all(sampleMetadataToDelete.map(key => sampleMetadataStore.delete(key)));

        // Delete associated file nodes
        const fileNodesStore = tx.objectStore('file_nodes');
        const fileNodesIndex = fileNodesStore.index('sample_group_id');
        const fileNodesToDelete = await fileNodesIndex.getAllKeys(id);
        await Promise.all(fileNodesToDelete.map(key => fileNodesStore.delete(key)));

        // Delete processed data
        const processedDataStore = tx.objectStore('processed_data');
        const processedDataIndex = processedDataStore.index('sample_id');
        const processedDataToDelete = await processedDataIndex.getAllKeys(id);
        await Promise.all(processedDataToDelete.map(key => processedDataStore.delete(key)));

        await tx.done;
    }

    // File Node methods
    async saveFileNode(node: FileNode): Promise<void> {
        const db = await this.getDB();
        await db.put('file_nodes', node);
    }

    async getFileNode(id: string): Promise<FileNode | undefined> {
        const db = await this.getDB();
        return db.get('file_nodes', id);
    }

    async getFileNodesByOrg(orgId: string): Promise<FileNode[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('file_nodes', 'org_id', orgId);
    }

    async deleteFileNode(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('file_nodes', id);
    }

    async getAllFileNodes(): Promise<FileNode[]> {
        const db = await this.getDB();
        return db.getAll('file_nodes');
    }

    // Sample Metadata methods
    async saveSampleMetadata(metadata: SampleMetadata): Promise<void> {
        const db = await this.getDB();
        await db.put('sample_metadata', metadata);
    }

    async getSampleMetadata(id: string): Promise<SampleMetadata | undefined> {
        const db = await this.getDB();
        return db.get('sample_metadata', id);
    }

    async getSampleMetadataBySampleGroupId(sampleGroupId: string): Promise<SampleMetadata[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('sample_metadata', 'sample_group_id', sampleGroupId);
    }

    async deleteSampleMetadata(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('sample_metadata', id);
    }

    // Sample Location methods
    async saveLocation(location: SampleLocation): Promise<void> {
        const db = await this.getDB();
        await db.put('sample_locations', location);
    }

    async getLocation(id: string): Promise<SampleLocation | undefined> {
        const db = await this.getDB();
        return db.get('sample_locations', id);
    }

    async getAllLocations(): Promise<SampleLocation[]> {
        const db = await this.getDB();
        return db.getAll('sample_locations');
    }

    // Processed Data methods
    async saveProcessedData(
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
    ): Promise<void> {
        const db = await this.getDB();
        const entry: ProcessedDataEntry = {
            key: `${sampleId}:${configId}`,
            sample_id: sampleId,
            human_readable_sample_id: humanReadableSampleId,
            config_id: configId,
            org_short_id: orgShortId,
            data,
            raw_file_paths: options.rawFilePaths || [],
            processed_path: options.processedPath || null,
            timestamp: Date.now(),
            status: 'processed',
            metadata: options.metadata
        };

        await db.put('processed_data', entry);
    }

    async getProcessedData(sampleId: string, configId: string): Promise<ProcessedDataEntry | null> {
        const db = await this.getDB();
        const key = `${sampleId}:${configId}`;
        const entry = await db.get('processed_data', key);
        return entry || null;
    }

    async getAllProcessedData(sampleId: string): Promise<Record<string, ProcessedDataEntry>> {
        const db = await this.getDB();
        const entries = await db.getAllFromIndex('processed_data', 'sample_id', sampleId);
        return entries.reduce((acc, entry) => {
            acc[entry.key] = entry;
            return acc;
        }, {} as Record<string, ProcessedDataEntry>);
    }

    async deleteProcessedData(sampleId: string, configId: string): Promise<void> {
        const db = await this.getDB();
        const key = `${sampleId}:${configId}`;
        await db.delete('processed_data', key);
    }

// ... previous code ...

    async queueRawFile(
        sampleId: string,
        configId: string,
        file: File,
        options: { customPath?: string } = {}
    ): Promise<void> {
        const db = await this.getDB();
        const filePath = options.customPath || `${sampleId}/${configId}/raw/${file.name}`;

        const queueItem: ProcessingQueueItem = {
            id: uuidv4(),
            type: 'raw',
            sampleId,
            configId,
            filePath,
            fileBlob: file,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending'
        };

        await db.add('processing_queue', queueItem);
    }

    async queueProcessedFile(
        sampleId: string,
        configId: string,
        data: Blob,
        options: { customPath?: string } = {}
    ): Promise<void> {
        const db = await this.getDB();
        const filePath = options.customPath || `${sampleId}/${configId}/processed/data.json`;

        const queueItem: ProcessingQueueItem = {
            id: uuidv4(),
            type: 'processed',
            sampleId,
            configId,
            filePath,
            fileBlob: data,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending'
        };

        await db.add('processing_queue', queueItem);
    }

    async getPendingUploads(): Promise<ProcessingQueueItem[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('processing_queue', 'status', 'pending');
    }

    async markUploadComplete(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('processing_queue', id);
    }

    async markUploadError(id: string, error: string): Promise<void> {
        const db = await this.getDB();
        const item = await db.get('processing_queue', id);
        if (item) {
            const updatedItem: ProcessingQueueItem = {
                ...item,
                status: 'error',
                retryCount: item.retryCount + 1,
                error
            };
            await db.put('processing_queue', updatedItem);
        }
    }

    // Pending Operations methods
    async getPendingOperation(id: string): Promise<PendingOperation | undefined> {
        const db = await this.getDB();
        return db.get('pending_operations', id);
    }

    async updatePendingOperation(operation: PendingOperation): Promise<void> {
        const db = await this.getDB();
        await db.put('pending_operations', operation);
    }

    async getPendingOperationsOrderedByTimestamp(): Promise<PendingOperation[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('pending_operations', 'timestamp');
    }

    async getAllFailedOperations(maxRetries: number): Promise<PendingOperation[]> {
        const operations = await this.getPendingOperationsOrderedByTimestamp();
        return operations.filter(op => op.retryCount >= maxRetries);
    }

    async deletePendingOperation(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('pending_operations', id);
    }

    async getPendingOperations(): Promise<PendingOperation[]> {
        const db = await this.getDB();
        return db.getAll('pending_operations');
    }

    async addPendingOperation(operation: Omit<PendingOperation, 'retryCount'>): Promise<void> {
        const db = await this.getDB();
        const operationWithRetry: PendingOperation = {
            ...operation,
            retryCount: 0
        };
        await db.add('pending_operations', operationWithRetry);
    }

    async incrementOperationRetry(id: string): Promise<void> {
        const db = await this.getDB();
        const operation = await db.get('pending_operations', id);
        if (operation) {
            const updatedOperation: PendingOperation = {
                ...operation,
                retryCount: operation.retryCount + 1
            };
            await db.put('pending_operations', updatedOperation);
        }
    }

    async clearFailedOperations(maxRetries: number): Promise<void> {
        const failedOps = await this.getAllFailedOperations(maxRetries);
        const db = await this.getDB();
        const tx = db.transaction('pending_operations', 'readwrite');
        await Promise.all(failedOps.map(op => tx.store.delete(op.id)));
        await tx.done;
    }

    // Utility methods
    async bulkSave<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(storeName, 'readwrite');
        await Promise.all(items.map(item => tx.store.put(item)));
        await tx.done;
    }

    async clearStore<T extends keyof AppDB>(storeName: T): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(storeName, 'readwrite');
        await tx.store.clear();
        await tx.done;
    }
}

// Export singleton instance
export const storage = IndexedDBStorageService.getInstance();