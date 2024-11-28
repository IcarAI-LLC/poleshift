// lib/storage/IndexedDB.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
    FileNode,
    LicenseKey,
    Organization,
    PendingOperation,
    SampleGroupMetadata,
    SampleLocation,
    UserProfile,
    UserTier,
    SampleMetadata,
    User,
    ProcessedDataEntry,
    ProcessingQueueItem
} from '../types';
import type { Session } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

interface AppDB extends DBSchema {
    user_tiers: {
        key: string; // 'name' is the primary key
        value: UserTier;
    };
    license_keys: {
        key: string; // 'id' as UUID string
        value: LicenseKey;
        indexes: { 'organization_id': string };
    };
    sample_locations: {
        key: string; // 'id' as UUID string
        value: SampleLocation;
    };
    organizations: {
        key: string; // 'id' as UUID string
        value: Organization;
    };
    user_profiles: {
        key: string; // 'id' as UUID string
        value: UserProfile;
        indexes: { 'organization_id': string };
    };
    sample_group_metadata: {
        key: string; // 'id' as UUID string
        value: SampleGroupMetadata;
        indexes: {
            'org_id': string;
            'user_id': string;
            'loc_id': string;
            'human_readable_sample_id': string;
        };
    };
    file_nodes: {
        key: string; // 'id' as UUID string
        value: FileNode;
        indexes: {
            'org_id': string;
            'sample_group_id': string;
            'parent_id': string;
        };
    };
    sample_metadata: {
        key: string; // 'id' as UUID string
        value: SampleMetadata;
        indexes: {
            'sample_group_id': string;
            'org_id': string;
            'user_id': string;
            'human_readable_sample_id': string;
        };
    };
    pending_operations: {
        key: string; // 'id' as UUID string
        value: PendingOperation;
        indexes: { 'timestamp': number };
    };
    processed_data: {
        key: string; // `${sampleId}:${configId}`
        value: ProcessedDataEntry;
        indexes: {
            'sample_id': string;
            'timestamp': number;
            'status': string;
        };
    };
    processing_queue: {
        key: string; // UUID
        value: ProcessingQueueItem;
        indexes: {
            'status': string;
            'timestamp': number;
            'type': string;
        };
    };
    sessions: {
        key: string; // 'id' as UUID string or constant key
        value: Session;
    };
    users: {
        key: string; // 'id' as UUID string or constant key
        value: User;
    };
}

// Define StoreNames as a union of all store names
type StoreNames =
    | 'user_tiers'
    | 'license_keys'
    | 'sample_locations'
    | 'organizations'
    | 'user_profiles'
    | 'sample_group_metadata'
    | 'file_nodes'
    | 'sample_metadata'
    | 'pending_operations'
    | 'processed_data'
    | 'processing_queue'
    | 'sessions'
    | 'users';

class IndexedDBStorage {
    private db: IDBPDatabase<AppDB> | null = null;
    private static instance: IndexedDBStorage;

    private constructor() {}

    public static getInstance(): IndexedDBStorage {
        if (!IndexedDBStorage.instance) {
            IndexedDBStorage.instance = new IndexedDBStorage();
        }
        return IndexedDBStorage.instance;
    }

    private async getDB(): Promise<IDBPDatabase<AppDB>> {
        if (!this.db) {
            this.db = await openDB<AppDB>('appDB', 2, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    // User Tiers
                    if (!db.objectStoreNames.contains('user_tiers')) {
                        db.createObjectStore('user_tiers', { keyPath: 'name' });
                    }

                    // License Keys
                    if (!db.objectStoreNames.contains('license_keys')) {
                        const licenseStore = db.createObjectStore('license_keys', { keyPath: 'id' });
                        licenseStore.createIndex('organization_id', 'organization_id');
                    }

                    // Sample Locations
                    if (!db.objectStoreNames.contains('sample_locations')) {
                        db.createObjectStore('sample_locations', { keyPath: 'id' });
                    }

                    // Organizations
                    if (!db.objectStoreNames.contains('organizations')) {
                        db.createObjectStore('organizations', { keyPath: 'id' });
                    }

                    // User Profiles
                    if (!db.objectStoreNames.contains('user_profiles')) {
                        const userProfileStore = db.createObjectStore('user_profiles', { keyPath: 'id' });
                        userProfileStore.createIndex('organization_id', 'organization_id');
                    }

                    // Sample Group Metadata
                    if (!db.objectStoreNames.contains('sample_group_metadata')) {
                        const sampleGroupStore = db.createObjectStore('sample_group_metadata', { keyPath: 'id' });
                        sampleGroupStore.createIndex('org_id', 'org_id');
                        sampleGroupStore.createIndex('user_id', 'user_id');
                        sampleGroupStore.createIndex('loc_id', 'loc_id');
                        sampleGroupStore.createIndex('human_readable_sample_id', 'human_readable_sample_id', { unique: true });
                    }

                    // File Nodes
                    if (!db.objectStoreNames.contains('file_nodes')) {
                        const fileNodesStore = db.createObjectStore('file_nodes', { keyPath: 'id' });
                        fileNodesStore.createIndex('org_id', 'org_id');
                        fileNodesStore.createIndex('sample_group_id', 'sample_group_id');
                        fileNodesStore.createIndex('parent_id', 'parent_id');
                    }

                    // Sample Metadata
                    if (!db.objectStoreNames.contains('sample_metadata')) {
                        const sampleMetaStore = db.createObjectStore('sample_metadata', { keyPath: 'id' });
                        sampleMetaStore.createIndex('sample_group_id', 'sample_group_id');
                        sampleMetaStore.createIndex('org_id', 'org_id');
                        sampleMetaStore.createIndex('user_id', 'user_id');
                        sampleMetaStore.createIndex('human_readable_sample_id', 'human_readable_sample_id');
                    }

                    // Pending Operations
                    if (!db.objectStoreNames.contains('pending_operations')) {
                        const pendingStore = db.createObjectStore('pending_operations', { keyPath: 'id' });
                        pendingStore.createIndex('timestamp', 'timestamp');
                    }

                    // Processed Data
                    if (!db.objectStoreNames.contains('processed_data')) {
                        const store = db.createObjectStore('processed_data', { keyPath: 'key' });
                        store.createIndex('sample_id', 'sample_id');
                        store.createIndex('timestamp', 'timestamp');
                        store.createIndex('status', 'status');
                    }

                    // Processing Queue
                    if (!db.objectStoreNames.contains('processing_queue')) {
                        const store = db.createObjectStore('processing_queue', { keyPath: 'id' });
                        store.createIndex('status', 'status');
                        store.createIndex('timestamp', 'timestamp');
                        store.createIndex('type', 'type');
                    }

                    // Sessions
                    if (!db.objectStoreNames.contains('sessions')) {
                        db.createObjectStore('sessions', { keyPath: 'key' });
                    }

                    // Users
                    if (!db.objectStoreNames.contains('users')) {
                        db.createObjectStore('users', { keyPath: 'key' });
                    }
                },
            });
        }
        return this.db;
    }

    // Generic CRUD Operations
    private async add<StoreName extends keyof AppDB>(
        storeName: StoreNames,
        item: AppDB[StoreName]['value']
    ): Promise<void> {
        const db = await this.getDB();
        await db.add(storeName, item);
    }

    private async put<StoreName extends keyof AppDB>(
        storeName: StoreNames,
        item: AppDB[StoreName]['value']
    ): Promise<void> {
        const db = await this.getDB();
        await db.put(storeName, item);
    }

    private async get<StoreName extends keyof AppDB>(
        storeName: StoreNames,
        key: AppDB[StoreName]['key']
    ): Promise<AppDB[StoreName]['value'] | undefined> {
        const db = await this.getDB();
        return db.get(storeName, key.toString());
    }

    private async delete<StoreName extends keyof AppDB>(
        storeName: StoreNames,
        key: AppDB[StoreName]['key']
    ): Promise<void> {
        const db = await this.getDB();
        await db.delete(storeName, key.toString());
    }

    private async getAllFromIndex<
        StoreName extends keyof AppDB,
        IndexName extends keyof AppDB[StoreName]['indexes']
    >(
        storeName: StoreName,
        indexName: IndexName,
        key: IDBValidKey | IDBKeyRange
    ): Promise<AppDB[StoreName]['value'][]> {
        const db = await this.getDB();
        return db.getAllFromIndex(storeName, indexName as string, key);
    }

    // Methods for Session and User Data
    async saveSession(session: Session): Promise<void> {
        await this.put('sessions', { key: 'session', ...session });
    }

    async getSession(): Promise<Session | undefined> {
        return this.get('sessions', 'session');
    }

    async removeSession(): Promise<void> {
        await this.delete('sessions', 'session');
    }

    async saveUser(user: User): Promise<void> {
        await this.put('users', { key: 'user', ...user });
    }

    async getUser(): Promise<User | undefined> {
        return this.get('users', 'user');
    }

    async removeUser(): Promise<void> {
        await this.delete('users', 'user');
    }

    // Specific Store Operations

    // Sample Groups
    async saveSampleGroup(group: SampleGroupMetadata): Promise<void> {
        await this.put('sample_group_metadata', group);
    }

    async getSampleGroup(id: string): Promise<SampleGroupMetadata | undefined> {
        return this.get('sample_group_metadata', id);
    }

    async getSampleGroupsByOrg(orgId: string): Promise<SampleGroupMetadata[]> {
        return this.getAllFromIndex('sample_group_metadata', 'org_id', orgId);
    }

    async deleteSampleGroup(id: string): Promise<void> {
        await this.delete('sample_group_metadata', id);
    }

    // File Nodes
    async saveFileNode(node: FileNode): Promise<void> {
        await this.put('file_nodes', node);
    }

    async getFileNode(id: string): Promise<FileNode | undefined> {
        return this.get('file_nodes', id);
    }

    async getFileNodesByOrg(orgId: string): Promise<FileNode[]> {
        return this.getAllFromIndex('file_nodes', 'org_id', orgId);
    }

    async deleteFileNode(id: string): Promise<void> {
        await this.delete('file_nodes', id);
    }

    async getAllFileNodes(): Promise<FileNode[]> {
        const db = await this.getDB();
        return db.getAll('file_nodes');
    }

    // Sample Metadata
    async saveSampleMetadata(sampleMetadata: SampleMetadata): Promise<void> {
        await this.put('sample_metadata', sampleMetadata);
    }

    async getSampleMetadata(id: string): Promise<SampleMetadata | undefined> {
        return await this.get('sample_metadata', id);
    }

    // Sample Groups
    async getAllSampleGroups(): Promise<SampleGroupMetadata[]> {
        const db = await this.getDB();
        return db.getAll('sample_group_metadata');
    }

    // Sample Locations
    async saveLocation(location: SampleLocation): Promise<void> {
        await this.put('sample_locations', location);
    }

    async getLocation(id: string): Promise<SampleLocation | undefined> {
        return this.get('sample_locations', id);
    }

    async getAllLocations(): Promise<SampleLocation[]> {
        const db = await this.getDB();
        return db.getAll('sample_locations');
    }

    // Organizations
    async saveOrganization(org: Organization): Promise<void> {
        await this.put('organizations', org);
    }

    async getOrganization(id: string): Promise<Organization | undefined> {
        return this.get('organizations', id);
    }

    // User Profiles
    async saveUserProfile(profile: UserProfile): Promise<void> {
        await this.put('user_profiles', profile);
    }

    async getUserProfile(id: string): Promise<UserProfile | undefined> {
        return this.get('user_profiles', id);
    }

    // Pending Operations
    async getPendingOperation(id: string): Promise<PendingOperation | undefined> {
        return this.get('pending_operations', id);
    }

    async updatePendingOperation(operation: PendingOperation): Promise<void> {
        await this.put('pending_operations', operation);
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
        await this.delete('pending_operations', id);
    }

    async getPendingOperations(): Promise<PendingOperation[]> {
        const db = await this.getDB();
        return db.getAll('pending_operations');
    }

    async addPendingOperation(operation: Omit<PendingOperation, 'retryCount'>): Promise<void> {
        const operationWithRetry = {
            ...operation,
            retryCount: 0  // Initialize retry count
        };
        await this.put('pending_operations', operationWithRetry);
    }

    async incrementOperationRetry(id: string): Promise<void> {
        const operation = await this.getPendingOperation(id);
        if (operation) {
            operation.retryCount = (operation.retryCount || 0) + 1;
            await this.updatePendingOperation(operation);
        }
    }

    async clearFailedOperations(maxRetries: number): Promise<void> {
        const failedOps = await this.getAllFailedOperations(maxRetries);
        const db = await this.getDB();
        const tx = db.transaction('pending_operations', 'readwrite');
        await Promise.all(
            failedOps.map(op => tx.store.delete(op.id))
        );
        await tx.done;
    }

    // Processed Data
    async saveProcessedData(
        sampleId: string,
        configId: string,
        data: any,
        options: {
            rawFilePaths?: string[];
            processedPath?: string;
            metadata?: ProcessedDataEntry['metadata'];
        } = {}
    ): Promise<void> {
        const entry: ProcessedDataEntry = {
            key: `${sampleId}:${configId}`,
            sampleId,
            configId,
            data,
            rawFilePaths: options.rawFilePaths || [],
            processedPath: options?.processedPath || null,
            timestamp: Date.now(),
            status: 'processed',
            metadata: options.metadata,
        };

        await this.put('processed_data', entry);
    }

    async getProcessedData(sampleId: string, configId: string): Promise<ProcessedDataEntry | null> {
        const key = `${sampleId}:${configId}`;
        const entry = await this.get('processed_data', key);
        return entry || null;
    }

    async getAllProcessedData(sampleId: string): Promise<Record<string, ProcessedDataEntry>> {
        const entries = await this.getAllFromIndex('processed_data', 'sample_id', sampleId);

        return entries.reduce((acc, entry) => {
            if (entry.key) {
                acc[entry.key] = entry;
            }
            return acc;
        }, {} as Record<string, ProcessedDataEntry>);
    }

    async deleteProcessedData(sampleId: string, configId: string): Promise<void> {
        const key = `${sampleId}:${configId}`;
        await this.delete('processed_data', key);
    }

    // Processing Queue Methods
    async queueRawFile(
        sampleId: string,
        configId: string,
        file: File,
        options: { customPath?: string } = {}
    ): Promise<void> {
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

        await this.add('processing_queue', queueItem);
    }

    async queueProcessedFile(
        sampleId: string,
        configId: string,
        data: Blob,
        options: { customPath?: string } = {}
    ): Promise<void> {
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

        await this.add('processing_queue', queueItem);
    }

    async getPendingUploads(): Promise<ProcessingQueueItem[]> {
        return this.getAllFromIndex('processing_queue', 'status', 'pending');
    }

    async markUploadComplete(id: string): Promise<void> {
        await this.delete('processing_queue', id);
    }

    async markUploadError(id: string, error: string): Promise<void> {
        const item = await this.get('processing_queue', id);
        if (item) {
            const updatedItem: ProcessingQueueItem = {
                ...item,
                status: 'error',
                retryCount: item.retryCount + 1,
                error
            };
            await this.put('processing_queue', updatedItem);
        }
    }

    // Utility methods
    async getQueueStats(): Promise<{ pending: number; error: number }> {
        const pending = await this.getAllFromIndex('processing_queue', 'status', 'pending');
        const errors = await this.getAllFromIndex('processing_queue', 'status', 'error');

        return {
            pending: pending.length,
            error: errors.length
        };
    }

    async clearErroredItems(maxRetries: number = 3): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('processing_queue', 'readwrite');
        const erroredItems = await tx.store.index('status').getAll('error');

        for (const item of erroredItems) {
            if (item.retryCount >= maxRetries) {
                await tx.store.delete(item.id);
            }
        }

        await tx.done;
    }

    // Bulk Operations
    async bulkSave<StoreName extends keyof AppDB>(
        storeName: StoreName,
        items: AppDB[StoreName]['value'][]
    ): Promise<void> {
        const db = await this.getDB();
        //@ts-ignore
        const tx = db.transaction(storeName, 'readwrite');
        for (const item of items) {
            await tx.store.put(item);
        }
        await tx.done;
    }

    async clearStore<StoreName extends keyof AppDB>(storeName: StoreName): Promise<void> {
        const db = await this.getDB();
        //@ts-ignore
        const tx = db.transaction(storeName, 'readwrite');
        await tx.store.clear();
        await tx.done;
    }
}

// Export both the type and the singleton instance
export type { IndexedDBStorage };
export const storage = IndexedDBStorage.getInstance();
