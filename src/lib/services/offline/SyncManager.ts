import { OperationQueue } from './OperationQueue';
import { SyncService } from '../SyncService';
import { PendingOperation } from "../../types";
import { networkService } from '../EnhancedNetworkService';

/**
 * Represents statistics for synchronization operations, providing insights into the number of operations and their outcomes.
 *
 * @interface SyncStats
 *
 * @property {number} totalOperations
 * Represents the total number of synchronization operations attempted.
 *
 * @property {number} successfulOperations
 * Represents the number of synchronization operations that were successfully completed.
 *
 * @property {number} failedOperations
 * Represents the number of synchronization operations that failed.
 *
 * @property {number} lastSyncAttempt
 * A timestamp representing the last time a synchronization attempt was made.
 *
 * @property {number | null} lastSuccessfulSync
 * A timestamp representing the last time a synchronization was successfully completed, or null if a successful sync has not occurred.
 */
interface SyncStats {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    lastSyncAttempt: number;
    lastSuccessfulSync: number | null;
}

/**
 * SyncManager is responsible for managing the synchronization of operations
 * with a remote server. It ensures that operations in the queue are processed
 * when there is an active network connection and handles retries with
 * exponential backoff in case of failures.
 */
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

    /**
     * Initializes the necessary components for the application to function correctly.
     * This method sets up network listeners and starts synchronization if the application
     * is currently online.
     *
     * @return {void} No return value.
     */
    private initialize() {
        this.setupNetworkListeners();
        this.startSyncIfOnline();
    }

    /**
     * Sets up network event listeners to handle changes in network connectivity status.
     * It registers event handlers for online and offline events via the network service.
     * The handlers, when triggered, execute corresponding methods to manage application
     * behavior based on network availability.
     *
     * @return {void} This method does not return a value.
     */
    private setupNetworkListeners() {
        networkService.addOnlineListener(this.handleOnline);
        networkService.addOfflineListener(this.handleOffline);
    }

    /**
     * An asynchronous function that is triggered when the system comes online.
     * It resets the consecutive failure count to zero and initiates a synchronization process.
     *
     * @function handleOnline
     */
    private handleOnline = async () => {
        // Reset failure count when we come online
        this.consecutiveFailures = 0;
        await this.startSync();
    };

    /**
     * A function to handle offline events.
     * When invoked, it stops the synchronization process.
     * This is typically used in scenarios where the application
     * detects loss of network connectivity and needs to
     * halt any ongoing data synchronization to avoid errors.
     *
     * The function leverages an existing method `stopSync`
     * that encapsulates the logic for stopping the synchronization.
     */
    private handleOffline = () => {
        this.stopSync();
    };

    /**
     * Initiates the synchronization process if there is an active network connection.
     *
     * @return {Promise<void>} A promise that resolves when the sync process is initiated,
     *         or immediately if there is no active network connection.
     */
    private async startSyncIfOnline() {
        if (await networkService.hasActiveConnection()) {
            await this.startSync();
        }
    }

    /**
     * Initiates the synchronization process if it is not already running. This involves processing any pending operations
     * initially and then setting up a regular interval to process these operations continuously.
     *
     * @return {Promise<void>} A promise that resolves once the initial pending operations have been processed and the synchronization interval has been established.
     */
    private async startSync() {
        if (this.syncInterval) return;

        await this.processPendingOperations();

        this.syncInterval = window.setInterval(async () => {
            await this.processPendingOperations();
        }, this.SYNC_INTERVAL);
    }

    /**
     * Stops the synchronization process by clearing the interval responsible for periodic synchronization updates.
     * Resets the interval property to null, indicating that the synchronization process is no longer active.
     *
     * @return {void} This method does not return a value.
     */
    private stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Processes pending operations from the operation queue while there is an active network connection
     * and sync is not already in progress. This method attempts to synchronize each operation and apply
     * exponential backoff in case of consecutive failures. It updates statistics on the total count of
     * operations processed, successful operations, and failed operations.
     *
     * The method continues processing operations until the operation queue is empty or the maximum number
     * of consecutive failures is reached.
     *
     * @return {Promise<void>} A promise that resolves once all pending operations are processed or an error occurs.
     */
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

    /**
     * Performs a synchronous operation on the provided pending operation.
     *
     * This method executes the specified sync operation and, if successful and
     * not a 'delete' operation, verifies the sync result using the sync service.
     * Logs errors if the execution or verification of the sync operation fails.
     *
     * @param {PendingOperation} operation - The operation to be synchronized.
     * @return {Promise<boolean>} - A promise that resolves to true if the
     * operation and verification (for non-delete operations) succeed, or false
     * if any error occurs during execution or verification.
     */
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

    /**
     * Executes a synchronization operation on the remote database based on the given operation type.
     * Handles 'create', 'update', 'delete', and 'upsert' operations and checks for an active network connection.
     * Logs errors if the operation fails or if the operation type is unknown.
     *
     * @param {PendingOperation} operation - The operation object containing the type of operation, the table to be operated on, and the data associated with the operation.
     * @return {Promise<boolean>} - A promise that resolves to true if the operation is successful; false otherwise.
     */
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

    /**
     * Handles the delay between consecutive failures by implementing an exponential backoff strategy.
     * The backoff time increases exponentially with each consecutive failure up to a maximum limit.
     *
     * @return {Promise<void>} A promise that resolves after the calculated backoff delay.
     */
    private async handleConsecutiveFailures() {
        const backoffTime = Math.min(
            1000 * Math.pow(2, this.consecutiveFailures - 1),
            300000 // Max backoff of 5 minutes
        );
        await new Promise(resolve => setTimeout(resolve, backoffTime));
    }

    /**
     * Retrieves a copy of the current synchronization statistics.
     *
     * @return {SyncStats} An object containing the current synchronization statistics.
     */
    public getStats(): SyncStats {
        return { ...this.stats };
    }

    /**
     * Cleans up resources by stopping synchronization and removing
     * network event listeners for online and offline events.
     *
     * @return {void} No return value.
     */
    public destroy() {
        this.stopSync();
        networkService.removeOnlineListener(this.handleOnline);
        networkService.removeOfflineListener(this.handleOffline);
    }
}