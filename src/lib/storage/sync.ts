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
        const { type, data } = operation;

        try {
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
                    // Check if the sample group exists by fetching all and finding the matching one
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
                    console.warn(`Unknown operation type: ${type}`);
            }
        } catch (error) {
            console.error(`Failed to process operation:`, operation, error);
            throw error;
        }
    }

    public async fullSync(orgId: string): Promise<void> {
        if (this.isSyncing || !navigator.onLine) return;

        try {
            this.isSyncing = true;

            // Sync pending operations first
            await this.syncPendingOperations();

            // Fetch all data from server
            const serverSampleGroups = await api.data.getSampleGroups(orgId);
            const localSampleGroups = await storage.getAllSampleGroups();

            // Compare and update local storage
            for (const serverGroup of serverSampleGroups) {
                const localGroup = localSampleGroups.find(g => g.id === serverGroup.id);

                if (!localGroup || this.isNewer(serverGroup, localGroup)) {
                    await storage.saveSampleGroup(serverGroup);
                }
            }

            // Handle deletions
            const serverIds = new Set(serverSampleGroups.map(g => g.id));
            const localIds = new Set(localSampleGroups.map(g => g.id));

            for (const localId of localIds) {
                if (!serverIds.has(localId)) {
                    await storage.deleteSampleGroup(localId);
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private isNewer(serverItem: any, localItem: any): boolean {
        const serverDate = new Date(serverItem.updated_at).getTime();
        const localDate = new Date(localItem.updated_at).getTime();
        return serverDate > localDate;
    }
}

export const syncManager = SyncManager.getInstance();