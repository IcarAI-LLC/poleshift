// src/lib/storage/indexedDB.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SampleGroup, TreeItem, ProcessingJob, ResearchLocation, PendingOperation } from '../types/data';
import { FileNode } from '../types/fileTree';
import { DefaultFileTreeAdapter } from '../adapters/fileTreeAdapter';

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
    fileTree: {
        key: string;
        value: TreeItem;
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
    processedData: {
        key: string;
        value: {
            key: string;
            sampleId: string;
            configId: string;
            data: any;
            updatedAt: number;
        };
    };
}

const DB_NAME = 'appDB';
const DB_VERSION = 4; // Incremented for new processedData store

class StorageManager {
    private db: IDBPDatabase<AppDB> | null = null;
    private static instance: StorageManager;
    private fileTreeAdapter: DefaultFileTreeAdapter;

    private constructor() {
        this.fileTreeAdapter = new DefaultFileTreeAdapter();
    }

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
                    // Create stores if they don't exist
                    if (!db.objectStoreNames.contains('sampleGroups')) {
                        db.createObjectStore('sampleGroups', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('fileTree')) {
                        db.createObjectStore('fileTree', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('fileNodes')) {
                        const fileNodesStore = db.createObjectStore('fileNodes', { keyPath: 'id' });
                        fileNodesStore.createIndex('org_id', 'org_id');
                        fileNodesStore.createIndex('sample_group_id', 'sample_group_id');
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

                    if (!db.objectStoreNames.contains('processedData')) {
                        db.createObjectStore('processedData', { keyPath: 'key' });
                    }
                },
            });
        }
        return this.db;
    }

    // New methods for processedData
    async saveProcessedData(
        sampleId: string,
        configId: string,
        data: any,
        updatedAt: number
    ): Promise<void> {
        const db = await this.getDB();
        const key = `${sampleId}:${configId}`;
        await db.put('processedData', { key, sampleId, configId, data, updatedAt });
    }

    async getProcessedData(
        sampleId: string,
        configId: string
    ): Promise<{ data: any; updatedAt: number } | undefined> {
        const db = await this.getDB();
        const key = `${sampleId}:${configId}`;
        const entry = await db.get('processedData', key);
        if (entry) {
            return { data: entry.data, updatedAt: entry.updatedAt };
        }
        return undefined;
    }

    // Pending Operations methods
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

    async clearPendingOperations(): Promise<void> {
        const db = await this.getDB();
        await db.clear('pendingOperations');
    }

    // Existing methods...

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

    // New FileNode methods
    async saveFileNode(node: FileNode): Promise<void> {
        const db = await this.getDB();
        await db.put('fileNodes', node);
        // Also save as TreeItem for backwards compatibility
        await this.saveTreeItem(this.fileTreeAdapter.fileNodeToTreeItem(node));
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

    async deleteFileNode(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('fileNodes', id);
        await this.deleteTreeItem(id); // Keep fileTree in sync
    }

    // Original methods with FileNode integration
    async saveTreeItem(item: TreeItem): Promise<void> {
        const db = await this.getDB();
        await db.put('fileTree', item);
    }

    async getTreeItem(id: string): Promise<TreeItem | undefined> {
        const db = await this.getDB();
        // Try to get from fileNodes first, fall back to fileTree
        const fileNode = await this.getFileNode(id);
        if (fileNode) {
            return this.fileTreeAdapter.fileNodeToTreeItem(fileNode);
        }
        return db.get('fileTree', id);
    }

    async getAllTreeItems(): Promise<TreeItem[]> {
        const db = await this.getDB();
        // Prefer fileNodes, fall back to fileTree
        const fileNodes = await db.getAll('fileNodes');
        if (fileNodes.length > 0) {
            return fileNodes.map(node => this.fileTreeAdapter.fileNodeToTreeItem(node));
        }
        return db.getAll('fileTree');
    }

    async deleteTreeItem(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('fileTree', id);
    }
}

export const storage = StorageManager.getInstance();