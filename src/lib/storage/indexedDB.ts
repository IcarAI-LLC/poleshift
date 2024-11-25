import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SampleGroup, TreeItem, ProcessingJob, Location } from '../types';

interface AppDB extends DBSchema {
    sampleGroups: {
        key: string;
        value: SampleGroup;
    };
    fileTree: {
        key: string;
        value: TreeItem;
    };
    processingJobs: {
        key: string;
        value: ProcessingJob;
    };
    locations: {
        key: string;  // Using location id as key
        value: Location;
    };
    pendingOperations: {
        key: string;
        value: PendingOperation;
        indexes: {
            'timestamp': number;
        };
    };
}

export interface PendingOperation {
    id: string;
    type: 'insert' | 'update' | 'delete' | 'upsert';
    table: string;
    data: any;
    timestamp: number;
}

const DB_NAME = 'appDB';
const DB_VERSION = 2; // Increment version for new store

class StorageManager {
    private db: IDBPDatabase<AppDB> | null = null;
    private static instance: StorageManager;

    private constructor() {}

    public static getInstance(): StorageManager {
        if (!StorageManager.instance) {
            StorageManager.instance = new StorageManager();
        }
        return StorageManager.instance;
    }

    private async getDB(): Promise<IDBPDatabase<AppDB>> {
        if (!this.db) {
            this.db = await openDB<AppDB>(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    // Create stores
                    if (!db.objectStoreNames.contains('sampleGroups')) {
                        db.createObjectStore('sampleGroups', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('fileTree')) {
                        db.createObjectStore('fileTree', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('processingJobs')) {
                        db.createObjectStore('processingJobs', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('locations')) {
                        db.createObjectStore('locations', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('pendingOperations')) {
                        const store = db.createObjectStore('pendingOperations', { keyPath: 'id' });
                        store.createIndex('timestamp', 'timestamp');
                    }
                },
            });
        }
        return this.db;
    }

    // Sample Groups
    async saveSampleGroup(sampleGroup: SampleGroup): Promise<void> {
        const db = await this.getDB();
        await db.put('sampleGroups', sampleGroup);
    }

    async getSampleGroup(id: string): Promise<SampleGroup | undefined> {
        const db = await this.getDB();
        return db.get('sampleGroups', id);
    }

    async getAllSampleGroups(): Promise<SampleGroup[]> {
        const db = await this.getDB();
        return db.getAll('sampleGroups');
    }

    async deleteSampleGroup(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('sampleGroups', id);
    }

    // File Tree
    async saveTreeItem(item: TreeItem): Promise<void> {
        const db = await this.getDB();
        await db.put('fileTree', item);
    }

    async getTreeItem(id: string): Promise<TreeItem | undefined> {
        const db = await this.getDB();
        return db.get('fileTree', id);
    }

    async getAllTreeItems(): Promise<TreeItem[]> {
        const db = await this.getDB();
        return db.getAll('fileTree');
    }

    async deleteTreeItem(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('fileTree', id);
    }

    // Processing Jobs
    async saveProcessingJob(job: ProcessingJob): Promise<void> {
        const db = await this.getDB();
        await db.put('processingJobs', job);
    }

    async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
        const db = await this.getDB();
        return db.get('processingJobs', id);
    }

    async getAllProcessingJobs(): Promise<ProcessingJob[]> {
        const db = await this.getDB();
        return db.getAll('processingJobs');
    }

    async deleteProcessingJob(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('processingJobs', id);
    }

    // Pending Operations
    async addPendingOperation(operation: Omit<PendingOperation, 'id'>): Promise<void> {
        const db = await this.getDB();
        const id = crypto.randomUUID();
        await db.add('pendingOperations', {
            ...operation,
            id,
            timestamp: Date.now(),
        });
    }

    async getPendingOperations(): Promise<PendingOperation[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('pendingOperations', 'timestamp');
    }

    async deletePendingOperation(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('pendingOperations', id);
    }

    async clearAllPendingOperations(): Promise<void> {
        const db = await this.getDB();
        await db.clear('pendingOperations');
    }

    // Updated Locations methods
    async saveLocations(locations: Location[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('locations', 'readwrite');
        const store = tx.objectStore('locations');

        // Clear existing locations
        await store.clear();

        // Add all new locations
        await Promise.all(locations.map(location => store.add(location)));

        await tx.done;
    }

    async getLocations(): Promise<Location[]> {
        const db = await this.getDB();
        return db.getAll('locations');
    }

    async getLocation(id: string): Promise<Location | undefined> {
        const db = await this.getDB();
        return db.get('locations', id);
    }

    async updateLocation(location: Location): Promise<void> {
        const db = await this.getDB();
        await db.put('locations', location);
    }
}

export const storage = StorageManager.getInstance();