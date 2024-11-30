import { OperationQueue } from './OperationQueue';
import { SyncService } from '../SyncService';
import { PendingOperation } from "../../types";
import { networkService } from '../EnhancedNetworkService';

interface SyncStats {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    lastSyncAttempt: number;
    lastSuccessfulSync: number | null;
}

export class SyncManager {
    private syncInProgress = false;
    private syncInterval: number | null = null;
    private readonly SYNC_INTERVAL = 30000; // 30 seconds
    private readonly MAX_CONSECUTIVE_FAILURES = 3;
    private consecutiveFailures = 0;
    private stats: SyncStats = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        lastSyncAttempt: 0,
        lastSuccessfulSync: null
    };

    constructor(
        private operationQueue: OperationQueue,
        private syncService: SyncService
    ) {
        // Initialize sync manager after network service is fully initialized
        if (networkService.isInitialized()) {
            this.initialize();
        } else {
            networkService.onInitialized(() => {
                this.initialize();
            });
        }
    }

    private initialize() {
        this.setupNetworkListeners();
        this.startSyncIfOnline();
    }

    private setupNetworkListeners() {
        networkService.addOnlineListener(this.handleOnline);
        networkService.addOfflineListener(this.handleOffline);
    }

    private handleOnline = async () => {
        // Reset failure count when we come online
        this.consecutiveFailures = 0;
        await this.startSync();
    };

    private handleOffline = () => {
        this.stopSync();
    };

    private async startSyncIfOnline() {
        if (await networkService.hasActiveConnection()) {
            await this.startSync();
        }
    }

    private async startSync() {
        if (this.syncInterval) return;

        await this.processPendingOperations();

        this.syncInterval = window.setInterval(async () => {
            await this.processPendingOperations();
        }, this.SYNC_INTERVAL);
    }

    private stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    private async processPendingOperations(): Promise<void> {
        if (this.syncInProgress || !(await networkService.hasActiveConnection())) {
            return;
        }

        this.syncInProgress = true;
        this.stats.lastSyncAttempt = Date.now();

        try {
            let operation = await this.operationQueue.dequeue();

            while (operation && this.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
                this.stats.totalOperations++;
                const success = await this.syncOperation(operation);

                if (success) {
                    await this.operationQueue.remove(operation.id);
                    this.stats.successfulOperations++;
                    this.consecutiveFailures = 0;
                    this.stats.lastSuccessfulSync = Date.now();
                } else {
                    this.stats.failedOperations++;
                    this.consecutiveFailures++;

                    const shouldRetry = await this.operationQueue.shouldRetry(operation);
                    if (shouldRetry) {
                        await this.operationQueue.updateRetryCount(operation);

                        // Apply exponential backoff if we have consecutive failures
                        if (this.consecutiveFailures > 0) {
                            await this.handleConsecutiveFailures();
                        }
                    } else {
                        // If we shouldn't retry, remove the operation
                        await this.operationQueue.remove(operation.id);
                    }
                }

                operation = await this.operationQueue.dequeue();
            }
        } catch (error) {
            console.error('Process pending operations failed:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    private async syncOperation(operation: PendingOperation): Promise<boolean> {
        try {
            const result = await this.executeSyncOperation(operation);

            // Only verify non-delete operations
            if (result && operation.type !== 'delete') {
                try {
                    return await this.syncService.verifySync(
                        operation.table,
                        operation.data.id
                    );
                } catch (verifyError) {
                    console.error('Sync verification failed:', verifyError);
                    return false;
                }
            }

            return result;
        } catch (error) {
            console.error('Sync operation failed:', error);
            return false;
        }
    }

    private async executeSyncOperation(operation: PendingOperation): Promise<boolean> {
        if (!(await networkService.hasActiveConnection())) {
            return false;
        }

        try {
            switch (operation.type) {
                case 'create':
                    await this.syncService.createRemote(operation.table, operation.data);
                    break;
                case 'update':
                    await this.syncService.updateRemote(operation.table, operation.data);
                    break;
                case 'delete':
                    await this.syncService.deleteRemote(operation.table, operation.data.id);
                    break;
                case 'upsert':
                    await this.syncService.upsertRemote(operation.table, operation.data);
                    break;
                default:
                    console.error('Unknown operation type:', operation.type);
                    return false;
            }
            return true;
        } catch (error) {
            console.error(`Failed to execute ${operation.type} operation:`, error);
            return false;
        }
    }

    private async handleConsecutiveFailures() {
        const backoffTime = Math.min(
            1000 * Math.pow(2, this.consecutiveFailures - 1),
            300000 // Max backoff of 5 minutes
        );
        await new Promise(resolve => setTimeout(resolve, backoffTime));
    }

    public getStats(): SyncStats {
        return { ...this.stats };
    }

    public destroy() {
        this.stopSync();
        networkService.removeOnlineListener(this.handleOnline);
        networkService.removeOfflineListener(this.handleOffline);
    }
}