import { v4 as uuidv4 } from 'uuid';
import type { StorageService } from '../storage/StorageService';
import type { PendingOperation } from '../../types';

export class QueueService {
    private readonly MAX_RETRIES = 3;

    constructor(private storageService: StorageService) {}

    async enqueue(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
        const queuedOperation: PendingOperation = {
            id: uuidv4(),
            ...operation,
            timestamp: Date.now(),
            retryCount: 0
        };

        await this.storageService.addPendingOperation(queuedOperation);
    }

    async dequeue(): Promise<PendingOperation | null> {
        const operations = await this.storageService.getPendingOperationsOrderedByTimestamp();
        return operations.length > 0 ? operations[0] : null;
    }

    async remove(operationId: string): Promise<void> {
        await this.storageService.deletePendingOperation(operationId);
    }

    async shouldRetry(operation: PendingOperation): Promise<boolean> {
        return operation.retryCount < this.MAX_RETRIES;
    }

    async updateRetryCount(operation: PendingOperation): Promise<void> {
        await this.storageService.incrementOperationRetry(operation.id);
    }

    async clearFailedOperations(): Promise<void> {
        await this.storageService.clearFailedOperations(this.MAX_RETRIES);
    }

    async getPendingOperations(): Promise<PendingOperation[]> {
        return this.storageService.getPendingOperations();
    }
}