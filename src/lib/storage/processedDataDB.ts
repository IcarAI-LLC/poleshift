import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
    ProcessedDataStorage,
    ProcessedDataEntry,
    ProcessingQueueItem
} from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ProcessedDataDB extends DBSchema {
    processedData: {
        key: string; // `${sampleId}:${configId}`
        value: ProcessedDataEntry;
        indexes: {
            'sampleId': string;
            'timestamp': number;
            'status': string;
        };
    };
    processingQueue: {
        key: string; // UUID
        value: ProcessingQueueItem;
        indexes: {
            'status': string;
            'timestamp': number;
            'type': string;
        };
    };
}

export class IndexedDBProcessedDataStorage implements ProcessedDataStorage {
    private db: IDBPDatabase<ProcessedDataDB> | null = null;
    private static instance: IndexedDBProcessedDataStorage;

    private constructor() {}

    public static getInstance(): IndexedDBProcessedDataStorage {
        if (!IndexedDBProcessedDataStorage.instance) {
            IndexedDBProcessedDataStorage.instance = new IndexedDBProcessedDataStorage();
        }
        return IndexedDBProcessedDataStorage.instance;
    }

    private async getDB(): Promise<IDBPDatabase<ProcessedDataDB>> {
        if (!this.db) {
            this.db = await openDB<ProcessedDataDB>('processedDataDB', 1, {
                upgrade(db) {
                    // Processed Data Store
                    if (!db.objectStoreNames.contains('processedData')) {
                        const store = db.createObjectStore('processedData', {
                            keyPath: 'key'
                        });
                        store.createIndex('sampleId', 'sampleId');
                        store.createIndex('timestamp', 'timestamp');
                        store.createIndex('status', 'status');
                    }

                    // Processing Queue Store
                    if (!db.objectStoreNames.contains('processingQueue')) {
                        const store = db.createObjectStore('processingQueue', {
                            keyPath: 'id'
                        });
                        store.createIndex('status', 'status');
                        store.createIndex('timestamp', 'timestamp');
                        store.createIndex('type', 'type');
                    }
                },
            });
        }
        return this.db;
    }

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
        const db = await this.getDB();
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

        await db.put('processedData', entry);
    }

    async getProcessedData(sampleId: string, configId: string): Promise<ProcessedDataEntry | null> {
        const db = await this.getDB();
        const key = `${sampleId}:${configId}`;
        const entry = await db.get('processedData', key);
        return entry || null;
    }

    async getAllProcessedData(sampleId: string): Promise<Record<string, ProcessedDataEntry>> {
        const db = await this.getDB();
        const entries = await db.getAllFromIndex('processedData', 'sampleId', sampleId);

        return entries.reduce((acc, entry) => {
            if (entry.key) {
                acc[entry.key] = entry;
            }
            return acc;
        }, {} as Record<string, ProcessedDataEntry>);
    }

    async deleteProcessedData(sampleId: string, configId: string): Promise<void> {
        const db = await this.getDB();
        const key = `${sampleId}:${configId}`;
        await db.delete('processedData', key);
    }

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

        await db.add('processingQueue', queueItem);
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

        await db.add('processingQueue', queueItem);
    }

    async getPendingUploads(): Promise<ProcessingQueueItem[]> {
        const db = await this.getDB();
        return db.getAllFromIndex('processingQueue', 'status', 'pending');
    }

    async markUploadComplete(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete('processingQueue', id);
    }

    async markUploadError(id: string, error: string): Promise<void> {
        const db = await this.getDB();
        const item = await db.get('processingQueue', id);
        if (item) {
            const updatedItem: ProcessingQueueItem = {
                ...item,
                status: 'error',
                retryCount: item.retryCount + 1,
                error
            };
            await db.put('processingQueue', updatedItem);
        }
    }

    // Utility methods
    async getQueueStats(): Promise<{ pending: number; error: number }> {
        const db = await this.getDB();
        const pending = await db.getAllFromIndex('processingQueue', 'status', 'pending');
        const errors = await db.getAllFromIndex('processingQueue', 'status', 'error');

        return {
            pending: pending.length,
            error: errors.length
        };
    }

    async clearErroredItems(maxRetries: number = 3): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('processingQueue', 'readwrite');
        const erroredItems = await tx.store.index('status').getAll('error');

        for (const item of erroredItems) {
            if (item.retryCount >= maxRetries) {
                await tx.store.delete(item.id);
            }
        }

        await tx.done;
    }
}

export const processedDataStorage = IndexedDBProcessedDataStorage.getInstance();