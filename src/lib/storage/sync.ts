// src/lib/storage/sync.ts

import { storage } from './indexedDB';
import { api } from '../api';
import { PendingOperation } from '../types/data';

export class SyncManager {
    private static instance: SyncManager;
    private isSyncing: boolean = false;

    private constructor() {}

    public static getInstance(): SyncManager {
        if (!SyncManager.instance) {
            SyncManager.instance = new SyncManager();
        }
        return SyncManager.instance;
    }

    public async syncPendingOperations(): Promise<void> {
        if (this.isSyncing || !navigator.onLine) return;

        try {
            this.isSyncing = true;
            const operations = await storage.getPendingOperations();

            for (const operation of operations) {
                await this.processPendingOperation(operation);
                await storage.deletePendingOperation(operation.id);
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private async processPendingOperation(operation: PendingOperation): Promise<void> {
        const { type, data, table } = operation;

        try {
            switch (table) {
                case 'sample_group_metadata':
                    await this.processSampleGroupOperation(type, data);
                    break;
                case 'file_nodes':
                    await this.processFileNodeOperation(type, data);
                    break;
                default:
                    console.warn(`Unknown table in pending operation: ${table}`);
            }
        } catch (error) {
            console.error(`Failed to process operation:`, operation, error);
            throw error;
        }
    }

    private async processSampleGroupOperation(type: string, data: any): Promise<void> {
        switch (type) {
            case 'insert':
                await api.data.createSampleGroup(data);
                break;
            case 'update':
                await api.data.updateSampleGroup(data.id, data.updates);
                break;
            case 'delete':
                await api.data.deleteSampleGroup(data.id);
                break;
            case 'upsert': {
                const allGroups = await api.data.getSampleGroups(data.org_id);
                const exists = allGroups.find(group => group.id === data.id);

                if (exists) {
                    await api.data.updateSampleGroup(data.id, data);
                } else {
                    await api.data.createSampleGroup(data);
                }
                break;
            }
            default:
                console.warn(`Unknown operation type for sample group: ${type}`);
        }
    }

    private async processFileNodeOperation(type: string, data: any): Promise<void> {
        switch (type) {
            case 'insert':
                await api.fileTree.createSampleGroupNode(data.org_id,
                    data.sample_group_id,
                    data.name,
                    data?.parent_id);
                break;
            case 'update':
                await api.fileTree.updateNode(data.id, data.updates);
                break;
            case 'delete':
                await api.fileTree.deleteNode(data.id);
                break;
            case 'upsert': {
                const existingNode = await api.fileTree.getFileNode(data.id);
                if (existingNode) {
                    await api.fileTree.updateNode(data.id, data);
                } else {
                    await api.fileTree.createSampleGroupNode(data.org_id,
                        data.sample_group_id,
                        data.name,
                        data?.parent_id);
                }
                break;
            }
            default:
                console.warn(`Unknown operation type for file node: ${type}`);
        }
    }

    public async fullSync(orgId: string): Promise<void> {
        if (this.isSyncing || !navigator.onLine) return;

        try {
            this.isSyncing = true;

            // Sync pending operations first
            await this.syncPendingOperations();

            // Fetch all data from server
            const [serverSampleGroups, serverFileNodes] = await Promise.all([
                api.data.getSampleGroups(orgId),
                api.fileTree.getFileNodes(orgId),
            ]);

            const [localSampleGroups, localFileNodes] = await Promise.all([
                storage.getAllSampleGroups(),
                storage.getFileNodesByOrg(orgId),
            ]);

            // Sync sample groups
            await this.syncDataItems(
                serverSampleGroups,
                localSampleGroups,
                storage.saveSampleGroup.bind(storage),
                storage.deleteSampleGroup.bind(storage)
            );

            // Sync file nodes
            await this.syncDataItems(
                serverFileNodes,
                localFileNodes,
                storage.saveFileNode.bind(storage),
                storage.deleteFileNode.bind(storage)
            );
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncDataItems<T extends { id: string; updated_at: string }>(
        serverItems: T[],
        localItems: T[],
        saveFunction: (item: T) => Promise<void>,
        deleteFunction: (id: string) => Promise<void>
    ) {
        // Update or insert items
        for (const serverItem of serverItems) {
            const localItem = localItems.find(item => item.id === serverItem.id);

            if (!localItem || this.isNewer(serverItem, localItem)) {
                await saveFunction(serverItem);
            }
        }

        // Handle deletions
        const serverIds = new Set(serverItems.map(item => item.id));
        for (const localItem of localItems) {
            if (!serverIds.has(localItem.id)) {
                await deleteFunction(localItem.id);
            }
        }
    }

    private isNewer(serverItem: any, localItem: any): boolean {
        const serverDate = new Date(serverItem.updated_at).getTime();
        const localDate = new Date(localItem.updated_at).getTime();
        return serverDate > localDate;
    }
}

export const syncManager = SyncManager.getInstance();
