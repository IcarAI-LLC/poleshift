import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SampleGroup, ProcessingJob, ResearchLocation } from '../types';
import { FileNode } from '../types/fileTree';

interface AppDB extends DBSchema {
    sampleGroups: {
        key: string;
        value: SampleGroup;
    };
    fileNodes: {
        key: string;
        value: FileNode;
        indexes: {
            'org_id': string;
            'sample_group_id': string;
        };
    };
    processingJobs: {
        key: string;
        value: ProcessingJob;
    };
    locations: {
        key: string;
        value: ResearchLocation;
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
const DB_VERSION = 1;

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
                    // Create FileNodes store with indexes
                    const fileNodesStore = db.createObjectStore('fileNodes', { keyPath: 'id' });
                    fileNodesStore.createIndex('org_id', 'org_id');
                    fileNodesStore.createIndex('sample_group_id', 'sample_group_id');

                    // Create other stores
                    db.createObjectStore('sampleGroups', { keyPath: 'id' });
                    db.createObjectStore('processingJobs', { keyPath: 'id' });
                    db.createObjectStore('locations', { keyPath: 'id' });

                    // Create pending operations store with timestamp index
                    const pendingOpsStore = db.createObjectStore('pendingOperations', { keyPath: 'id' });
                    pendingOpsStore.createIndex('timestamp', 'timestamp');
                },
            });
        }
        return this.db;
    }

    // FileNode methods
    async saveFileNode(node: FileNode): Promise<void> {
        const db = await this.getDB();
        await db.put('fileNodes', node);
    }

    async saveFileNodes(nodes: FileNode[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('fileNodes', 'readwrite');
        await Promise.all(nodes.map(node => tx.store.put(node)));
        await tx.done;
    }

    async getFileNode(id: string): Promise<FileNode | undefined> {
        const db = await this.getDB();
        return db.get('fileNodes', id);
    }

    async getFileNodesByOrg(orgId: string): Promise<FileNode[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('fileNodes', 'org_id', orgId);
    }

    async getFileNodesBySampleGroup(sampleGroupId: string): Promise<FileNode[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('fileNodes', 'sample_group_id', sampleGroupId);
    }

    async getAllFileNodes(): Promise<FileNode[]> {
        const db = await this.getDB();
        return db.getAll('fileNodes');
    }

    async deleteFileNode(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('fileNodes', id);
    }

    async deleteFileNodes(ids: string[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('fileNodes', 'readwrite');
        await Promise.all(ids.map(id => tx.store.delete(id)));
        await tx.done;
    }

    // Sample Group methods
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

    // Processing Job methods
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

    // Location methods
    async saveLocations(locations: ResearchLocation[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('locations', 'readwrite');
        await tx.store.clear();
        await Promise.all(locations.map(location => tx.store.add(location)));
        await tx.done;
    }

    async getLocations(): Promise<ResearchLocation[]> {
        const db = await this.getDB();
        return db.getAll('locations');
    }

    async getLocation(id: string): Promise<ResearchLocation | undefined> {
        const db = await this.getDB();
        return db.get('locations', id);
    }

    async updateLocation(location: ResearchLocation): Promise<void> {
        const db = await this.getDB();
        await db.put('locations', location);
    }

    // Pending Operations methods
    async addPendingOperation(operation: Omit<PendingOperation, 'id'>): Promise<void> {
        const db = await this.getDB();
        const id = crypto.randomUUID();
        await db.add('pendingOperations', {
            ...operation,
            id,
            timestamp: Date.now()
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

    async clearPendingOperations(): Promise<void> {
        const db = await this.getDB();
        await db.clear('pendingOperations');
    }
}

export const storage = StorageManager.getInstance();