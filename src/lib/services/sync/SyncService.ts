const SYNC_INTERVAL = 30000; // 30 seconds
const SYNC_RETRY_DELAY = 5000; // 5 seconds
const MAX_SYNC_RETRIES = 3;

import type { PendingOperation, ProcessedDataEntry } from '../../types';
import type { ApiService } from '../api/ApiService';
import type { StorageService } from '../storage/StorageService';
import { useNetworkStore } from "../../stores/index.ts";
import { useDataStore } from "../../stores/index.ts";

export const initializeSync = (apiService: ApiService, storageService: StorageService) => {
    const networkStore = useNetworkStore.getState();
    const dataStore = useDataStore.getState();

    // Create a sync service instance
    const syncService = new SyncService(apiService, storageService);

    // Function to perform sync
    const performSync = async () => {
        if (!networkStore.isOnline) {
            console.log('Offline - skipping sync');
            return;
        }

        try {
            dataStore.setSyncing(true);

            // Use the local syncService instance instead of services.sync
            await syncService.syncToRemote();

            const tables = ['file_nodes', 'sample_group_metadata', 'sample_locations'];
            const lastSynced = dataStore.lastSynced;

            for (const table of tables) {
                await syncService.syncFromRemote(table, undefined, lastSynced);
            }

            dataStore.setSyncing(false);
            networkStore.setLastSuccessfulSync(Date.now());

        } catch (error) {
            console.error('Sync failed:', error);
            dataStore.setError(error instanceof Error ? error.message : 'Sync failed');
            dataStore.setSyncing(false);
        }
    };

    // Rest of code remains the same
    const startPeriodicSync = () => {
        const syncInterval = setInterval(() => {
            if (networkStore.isOnline) {
                performSync();
            }
        }, 30000);

        return () => clearInterval(syncInterval);
    };

    const setupNetworkListeners = () => {
        window.addEventListener('online', async () => {
            networkStore.setOnlineStatus(true);
            try {
                await performSync();
            } catch (error) {
                console.error('Initial sync failed:', error);
            }
        });

        window.addEventListener('offline', () => {
            networkStore.setOnlineStatus(false);
        });
    };

    const initialize = () => {
        setupNetworkListeners();
        return startPeriodicSync();
    };

    return {
        initialize,
        performSync
    };
};

// Rest of SyncService class implementation remains the same...
export class SyncService {
    private readonly DEFAULT_SYNC_OPTIONS: SyncOptions = {
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000
    };

    constructor(
        private apiService: ApiService,
        private storageService: StorageService
    ) {}

    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        options: SyncOptions = this.DEFAULT_SYNC_OPTIONS
    ): Promise<SyncResult<T>> {
        const { maxRetries = 3, retryDelay = 1000, timeout = 30000 } = options;
        let attempts = 0;
        const startTime = Date.now();

        while (attempts < maxRetries) {
            if (Date.now() - startTime > timeout) {
                return {
                    success: false,
                    error: new Error('Operation timed out')
                };
            }

            try {
                const result = await operation();
                return { success: true, data: result };
            } catch (error) {
                attempts++;
                if (attempts === maxRetries) {
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(String(error))
                    };
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
            }
        }

        return {
            success: false,
            error: new Error('Max retry attempts reached')
        };
    }

    async syncFromRemote(table: string, orgId?: string, since?: number): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            const data = await this.apiService.syncFromRemote(table, orgId, since);
            if (data?.length) {
                await this.storageService.bulkSave(table, data);
            }
            return data;
        });

        if (!result.success) {
            throw result.error;
        }
    }

    async syncToRemote(): Promise<void> {
        const pendingOps = await this.storageService.getPendingOperationsOrderedByTimestamp();
        const failedOperations: PendingOperation[] = [];

        for (const op of pendingOps) {
            const result = await this.executePendingOperation(op);

            if (result.success) {
                await this.storageService.deletePendingOperation(op.id);
            } else {
                failedOperations.push(op);
                await this.storageService.incrementOperationRetry(op.id);
            }
        }

        if (failedOperations.length > 0) {
            console.error(`${failedOperations.length} operations failed to sync`);
        }
    }

    private async executePendingOperation(op: PendingOperation): Promise<SyncResult<void>> {
        const operation = async () => {
            switch (op.type) {
                case 'create':
                case 'update':
                case 'upsert':
                    await this.apiService.syncToRemote(op.data, op.table);
                    break;
                case 'delete':
                    // Assuming ApiService has a method to handle deletions
                    await this.apiService.syncToRemote({ id: op.data.id, _deleted: true }, op.table);
                    break;
                default:
                    throw new Error(`Unknown operation type: ${op.type}`);
            }
        };

        return this.executeWithRetry(operation);
    }

    async syncProcessedData(entry: ProcessedDataEntry): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            await this.apiService.syncProcessedData(entry);
        });

        if (!result.success) {
            throw result.error;
        }
    }

    async verifySync(table: string, id: string): Promise<boolean> {
        const result = await this.executeWithRetry(async () => {
            return this.apiService.verifySync(table, id);
        });

        return result.success && result.data === true;
    }
}