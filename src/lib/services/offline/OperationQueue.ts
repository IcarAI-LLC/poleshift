import { v4 as uuidv4 } from 'uuid';
import type { PendingOperation } from '../../types';
import { IndexedDBStorage } from "../../storage/IndexedDB";

/**
 * Class representing an operation queue that manages the asynchronous processing and retry of operations
 * using IndexedDB for persistent storage.
 */
export class OperationQueue {
    constructor(private storage: IndexedDBStorage) {}

    private readonly MAX_RETRIES = 3;

    /**
     * Adds a new operation to the queue with a unique identifier, current timestamp,
     * and an initial retry count set to zero.
     *
     * @param {Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>} operation - The operation object to be enqueued, without 'id', 'timestamp', or 'retryCount' properties.
     * @return {Promise<void>} A promise that resolves when the operation has been successfully added to the queue.
     */
    async enqueue(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
        const queuedOperation: PendingOperation = {
            id: uuidv4(),
            ...operation,
            timestamp: Date.now(),
            retryCount: 0
        };

        await this.storage.addPendingOperation(queuedOperation);
    }

    /**
     * Removes and returns the oldest pending operation in the queue.
     * This method fetches the list of pending operations ordered by their timestamp
     * and returns the first operation in the list if available.
     *
     * @return {Promise<PendingOperation | null>} A promise that resolves to the oldest pending operation
     * if available, otherwise null if there are no pending operations.
     */
    async dequeue(): Promise<PendingOperation | null> {
        const operations = await this.storage.getPendingOperationsOrderedByTimestamp();
        return operations.length > 0 ? operations[0] : null;
    }

    /**
     * Removes a pending operation from the storage.
     *
     * @param {string} operationId - The unique identifier of the operation to be removed.
     * @return {Promise<void>} A promise that resolves when the operation has been successfully removed.
     */
    async remove(operationId: string): Promise<void> {
        await this.storage.deletePendingOperation(operationId);
    }

    /**
     * Determines whether a given pending operation should be retried based on its retry count.
     *
     * @param {PendingOperation} operation - The pending operation that is being evaluated.
     * @return {Promise<boolean>} A promise that resolves to true if the operation should be retried, or false otherwise.
     */
    async shouldRetry(operation: PendingOperation): Promise<boolean> {
        return operation.retryCount < this.MAX_RETRIES;
    }

    /**
     * Updates the retry count for a given pending operation by incrementing it by one.
     *
     * @param {PendingOperation} operation - The pending operation whose retry count needs to be updated.
     *
     * @return {Promise<void>} A promise that resolves when the operation's retry count is successfully updated in storage.
     */
    async updateRetryCount(operation: PendingOperation): Promise<void> {
        const updatedOperation = {
            ...operation,
            retryCount: operation.retryCount + 1
        };
        await this.storage.updatePendingOperation(updatedOperation);
    }
}