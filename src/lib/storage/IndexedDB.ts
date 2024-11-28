// lib/storage/IndexedDB.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
    FileNode,
    LicenseKey,
    Organization,
    PendingOperation,
    SampleGroupMetadata,
    SampleLocation,
    SampleMetadata,
    UserProfile,
    UserTier
} from '../types';

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
        key: string; // Composite key: `${sampleId}:${configId}`
        value: {
            key: string;
            sampleId: string;
            configId: string;
            data: any;
            updatedAt: number;
        };
    };
}

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
            this.db = await openDB<AppDB>('appDB', 13, {
                upgrade(db) {
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
                        db.createObjectStore('processed_data', { keyPath: 'key' });
                    }
                },
            });
        }
        return this.db;
    }

    // Generic CRUD Operations
    private async add<T>(storeName: string, item: T): Promise<void> {
        const db = await this.getDB();
        //@ts-ignore
        await db.add(storeName, item);
    }

    private async put<T>(storeName: string, item: T): Promise<void> {
        const db = await this.getDB();
        //@ts-ignore
        await db.put(storeName, item);
    }

    private async get<T>(storeName: string, key: string): Promise<T | undefined> {
        const db = await this.getDB();
        //@ts-ignore
        return db.get(storeName, key);
    }

    private async delete(storeName: string, key: string): Promise<void> {
        const db = await this.getDB();
        //@ts-ignore
        await db.delete(storeName, key);
    }

    private async getAllFromIndex<T>(
        storeName: string,
        indexName: string,
        key: any
    ): Promise<T[]> {
        const db = await this.getDB();
        //@ts-ignore
        return db.getAllFromIndex(storeName, indexName, key);
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

    // Sample Locations
    async saveLocation(location: SampleLocation): Promise<void> {
        await this.put('sample_locations', location);
    }

    // File Nodes
    async getAllFileNodes(): Promise<FileNode[]> {
        const db = await this.getDB();
        return db.getAll('file_nodes');
    }

    // Sample Groups
    async getAllSampleGroups(): Promise<SampleGroupMetadata[]> {
        const db = await this.getDB();
        return db.getAll('sample_group_metadata');
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

    // Pending Operations - Enhanced Methods
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
        await this.delete('pendingOperations', id);
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
        await this.add('pendingOperations', operationWithRetry);
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
        updatedAt: number
    ): Promise<void> {
        const key = `${sampleId}:${configId}`;
        await this.put('processed_data', {
            key,
            sampleId,
            configId,
            data,
            updatedAt
        });
    }

    async getProcessedData(sampleId: string, configId: string): Promise<any> {
        const key = `${sampleId}:${configId}`;
        return this.get('processed_data', key);
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