// lib/services/offline/SyncManager.ts
import { NetworkService } from './NetworkService';
import { OperationQueue } from './OperationQueue';
import { SyncService } from '../SyncService';
import {PendingOperation} from "../../types";

export class SyncManager {
    private syncInProgress = false;
    private syncInterval: number | null = null;

    constructor(
        private networkService: NetworkService,
        private operationQueue: OperationQueue,
        private syncService: SyncService
    ) {
        this.initialize();
    }

    private initialize() {
        this.networkService.onOnline(() => {
            this.startSync();
        });

        this.networkService.onOffline(() => {
            this.stopSync();
        });

        if (this.networkService.isOnline()) {
            this.startSync();
        }
    }

    private startSync() {
        if (this.syncInterval) return;

        this.processPendingOperations();

        this.syncInterval = window.setInterval(() => {
            this.processPendingOperations();
        }, 30000);
    }

    private stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    private async processPendingOperations(): Promise<void> {
        if (this.syncInProgress || !this.networkService.isOnline()) return;

        this.syncInProgress = true;
        try {
            let operation = await this.operationQueue.dequeue();
            while (operation) {
                const success = await this.syncOperation(operation);

                if (success) {
                    await this.operationQueue.remove(operation.id);
                } else {
                    if (await this.operationQueue.shouldRetry(operation)) {
                        await this.operationQueue.shouldRetry(operation);
                    } else {
                        await this.operationQueue.remove(operation.id);
                    }
                }

                operation = await this.operationQueue.dequeue();
            }
        } finally {
            this.syncInProgress = false;
            console.log("Sync complete");
        }
    }

    private async syncOperation(operation: PendingOperation): Promise<boolean> {
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
            }
            return true;
        } catch (error) {
            console.error('Sync operation failed:', error);
            return false;
        }
    }
}