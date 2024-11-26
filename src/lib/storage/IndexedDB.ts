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
    userTiers: {
        key: string; // 'name' is the primary key
        value: UserTier;
    };
    licenseKeys: {
        key: string; // 'id' as UUID string
        value: LicenseKey;
        indexes: { 'organization_id': string };
    };
    sampleLocations: {
        key: string; // 'id' as UUID string
        value: SampleLocation;
    };
    organizations: {
        key: string; // 'id' as UUID string
        value: Organization;
    };
    userProfiles: {
        key: string; // 'id' as UUID string
        value: UserProfile;
        indexes: { 'organization_id': string };
    };
    sampleGroupMetadata: {
        key: string; // 'id' as UUID string
        value: SampleGroupMetadata;
        indexes: {
            'org_id': string;
            'user_id': string;
            'loc_id': string;
            'human_readable_sample_id': string;
        };
    };
    fileNodes: {
        key: string; // 'id' as UUID string
        value: FileNode;
        indexes: {
            'org_id': string;
            'sample_group_id': string;
            'parent_id': string;
        };
    };
    sampleMetadata: {
        key: string; // 'id' as UUID string
        value: SampleMetadata;
        indexes: {
            'sample_group_id': string;
            'org_id': string;
            'user_id': string;
            'human_readable_sample_id': string;
        };
    };
    pendingOperations: {
        key: string; // 'id' as UUID string
        value: PendingOperation;
        indexes: { 'timestamp': number };
    };
    processedData: {
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
            this.db = await openDB<AppDB>('appDB', 1, {
                upgrade(db) {
                    // User Tiers
                    if (!db.objectStoreNames.contains('userTiers')) {
                        db.createObjectStore('userTiers', { keyPath: 'name' });
                    }

                    // License Keys
                    if (!db.objectStoreNames.contains('licenseKeys')) {
                        const licenseStore = db.createObjectStore('licenseKeys', { keyPath: 'id' });
                        licenseStore.createIndex('organization_id', 'organization_id');
                    }

                    // Sample Locations
                    if (!db.objectStoreNames.contains('sampleLocations')) {
                        db.createObjectStore('sampleLocations', { keyPath: 'id' });
                    }

                    // Organizations
                    if (!db.objectStoreNames.contains('organizations')) {
                        db.createObjectStore('organizations', { keyPath: 'id' });
                    }

                    // User Profiles
                    if (!db.objectStoreNames.contains('userProfiles')) {
                        const userProfileStore = db.createObjectStore('userProfiles', { keyPath: 'id' });
                        userProfileStore.createIndex('organization_id', 'organization_id');
                    }

                    // Sample Group Metadata
                    if (!db.objectStoreNames.contains('sampleGroupMetadata')) {
                        const sampleGroupStore = db.createObjectStore('sampleGroupMetadata', { keyPath: 'id' });
                        sampleGroupStore.createIndex('org_id', 'org_id');
                        sampleGroupStore.createIndex('user_id', 'user_id');
                        sampleGroupStore.createIndex('loc_id', 'loc_id');
                        sampleGroupStore.createIndex('human_readable_sample_id', 'human_readable_sample_id', { unique: true });
                    }

                    // File Nodes
                    if (!db.objectStoreNames.contains('fileNodes')) {
                        const fileNodesStore = db.createObjectStore('fileNodes', { keyPath: 'id' });
                        fileNodesStore.createIndex('org_id', 'org_id');
                        fileNodesStore.createIndex('sample_group_id', 'sample_group_id');
                        fileNodesStore.createIndex('parent_id', 'parent_id');
                    }

                    // Sample Metadata
                    if (!db.objectStoreNames.contains('sampleMetadata')) {
                        const sampleMetaStore = db.createObjectStore('sampleMetadata', { keyPath: 'id' });
                        sampleMetaStore.createIndex('sample_group_id', 'sample_group_id');
                        sampleMetaStore.createIndex('org_id', 'org_id');
                        sampleMetaStore.createIndex('user_id', 'user_id');
                        sampleMetaStore.createIndex('human_readable_sample_id', 'human_readable_sample_id');
                    }

                    // Pending Operations
                    if (!db.objectStoreNames.contains('pendingOperations')) {
                        const pendingStore = db.createObjectStore('pendingOperations', { keyPath: 'id' });
                        pendingStore.createIndex('timestamp', 'timestamp');
                    }

                    // Processed Data
                    if (!db.objectStoreNames.contains('processedData')) {
                        db.createObjectStore('processedData', { keyPath: 'key' });
                    }
                },
            });
        }
        return this.db;
    }

    // Generic CRUD Operations
    private async add<T>(storeName: string, item: T): Promise<void> {
        const db = await this.getDB();
        await db.add(storeName, item);
    }

    private async put<T>(storeName: string, item: T): Promise<void> {
        const db = await this.getDB();
        await db.put(storeName, item);
    }

    private async get<T>(storeName: string, key: string): Promise<T | undefined> {
        const db = await this.getDB();
        return db.get(storeName, key);
    }

    private async delete(storeName: string, key: string): Promise<void> {
        const db = await this.getDB();
        await db.delete(storeName, key);
    }

    private async getAllFromIndex<T>(
        storeName: string,
        indexName: string,
        key: any
    ): Promise<T[]> {
        const db = await this.getDB();
        return db.getAllFromIndex(storeName, indexName, key);
    }

    // Specific Store Operations

    // Sample Groups
    async saveSampleGroup(group: SampleGroupMetadata): Promise<void> {
        await this.put('sampleGroupMetadata', group);
    }

    async getSampleGroup(id: string): Promise<SampleGroupMetadata | undefined> {
        return this.get('sampleGroupMetadata', id);
    }

    async getSampleGroupsByOrg(orgId: string): Promise<SampleGroupMetadata[]> {
        return this.getAllFromIndex('sampleGroupMetadata', 'org_id', orgId);
    }

    async deleteSampleGroup(id: string): Promise<void> {
        await this.delete('sampleGroupMetadata', id);
    }

    // File Nodes
    async saveFileNode(node: FileNode): Promise<void> {
        await this.put('fileNodes', node);
    }

    async getFileNode(id: string): Promise<FileNode | undefined> {
        return this.get('fileNodes', id);
    }

    async getFileNodesByOrg(orgId: string): Promise<FileNode[]> {
        return this.getAllFromIndex('fileNodes', 'org_id', orgId);
    }

    async deleteFileNode(id: string): Promise<void> {
        await this.delete('fileNodes', id);
    }

    // Sample Locations
    async saveLocation(location: SampleLocation): Promise<void> {
        await this.put('sampleLocations', location);
    }

    async getLocation(id: string): Promise<SampleLocation | undefined> {
        return this.get('sampleLocations', id);
    }

    async getAllLocations(): Promise<SampleLocation[]> {
        const db = await this.getDB();
        return db.getAll('sampleLocations');
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
        await this.put('userProfiles', profile);
    }

    async getUserProfile(id: string): Promise<UserProfile | undefined> {
        return this.get('userProfiles', id);
    }

    // Pending Operations
    async addPendingOperation(operation: PendingOperation): Promise<void> {
        await this.add('pendingOperations', operation);
    }

    async getPendingOperations(): Promise<PendingOperation[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('pendingOperations', 'timestamp');
    }

    async deletePendingOperation(id: string): Promise<void> {
        await this.delete('pendingOperations', id);
    }

    // Processed Data
    async saveProcessedData(
        sampleId: string,
        configId: string,
        data: any,
        updatedAt: number
    ): Promise<void> {
        const key = `${sampleId}:${configId}`;
        await this.put('processedData', {
            key,
            sampleId,
            configId,
            data,
            updatedAt
        });
    }

    async getProcessedData(sampleId: string, configId: string): Promise<any> {
        const key = `${sampleId}:${configId}`;
        return this.get('processedData', key);
    }

    // Bulk Operations
    async bulkSave<T>(storeName: string, items: T[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(storeName, 'readwrite');
        await Promise.all(items.map(item => tx.store.put(item)));
        await tx.done;
    }

    async clearStore(storeName: string): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(storeName, 'readwrite');
        await tx.store.clear();
        await tx.done;
    }
}

export const storage = IndexedDBStorage.getInstance();