import { SupabaseClient } from "@supabase/supabase-js";
import { BaseService } from "./BaseService";
import { IndexedDBStorage } from "../storage/IndexedDB";
import { ProcessedDataEntry, PendingOperation } from "../types";
import { networkService } from "./EnhancedNetworkService";

/**
 * Interface representing synchronization options for certain operations.
 * This configuration allows you to customize retry behaviors and timeout settings.
 *
 * @property {number} [maxRetries] - Specifies the maximum number of retry attempts for an operation if it fails.
 * @property {number} [retryDelay] - Defines the delay in milliseconds between each retry attempt.
 * @property {number} [timeout] - Indicates the maximum time in milliseconds to wait for an operation before timing out.
 */
interface SyncOptions {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
}

/**
 * Represents the result of a synchronization operation.
 *
 * @template T The type of the data associated with a successful operation.
 *
 * @property {boolean} success Indicates whether the synchronization operation was successful.
 * @property {T} [data] Contains the data resulting from a successful synchronization operation, if applicable.
 * @property {Error} [error] Contains the error information if the synchronization operation failed.
 */
interface SyncResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
}

/**
 * SyncService handles synchronization between a local IndexedDB and a remote Supabase database.
 * It extends the BaseService class to inherit basic storage functionalities.
 * This service provides methods for creating, updating, deleting, and synchronizing data
 * with retry logic for improved reliability.
 */
export class SyncService extends BaseService {
    protected storageKey: string = 'sync';
    private readonly DEFAULT_SYNC_OPTIONS: SyncOptions = {
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000
    };

    constructor(
        public supabase: SupabaseClient,
        storage: IndexedDBStorage
    ) {
        super(storage);
    }

    /**
     * Executes a given asynchronous operation with retry logic. Attempts to execute the operation
     * multiple times until it succeeds, a maximum retry count is reached, or the execution times out.
     *
     * @param {() => Promise<T>} operation - The asynchronous operation to be executed. This should be a function that returns a promise.
     * @param {SyncOptions} [options] - Optional parameter to define retry and timeout settings. Includes maxRetries, retryDelay, and timeout.
     * @return {Promise<SyncResult<T>>} A promise that resolves to an object indicating the success or failure of the operation.
     * On success, the object contains the result of the operation. On failure, the object contains an error.
     */
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
                if (await networkService.hasActiveConnection()) {
                    const result = await operation();
                    return { success: true, data: result };
                } else {
                    attempts++;
                    if (attempts === maxRetries) {
                        return {
                            success: false,
                            error: new Error('No network connection available')
                        };
                    }
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            } catch (error) {
                console.error(error);
                attempts++;
                if (attempts === maxRetries) {
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(String(error))
                    };
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempts)); // Exponential backoff
            }
        }

        return {
            success: false,
            error: new Error('Max retry attempts reached')
        };
    }

    /**
     * Asynchronously creates a new entry in a remote database table.
     *
     * @param {string} table - The name of the target table where the data should be inserted.
     * @param {T} data - The data object to be inserted into the table.
     * @return {Promise<void>} A promise that resolves when the operation is complete. If an error occurs during insertion, it throws an exception.
     */
    async createRemote<T>(table: string, data: T): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            const { error } = await this.supabase
                .from(table)
                .insert(data);

            if (error) throw error;
            return true;
        });

        if (!result.success) {
            this.handleError(result.error, `Failed to create remote ${table}`);
        }
    }

    /**
     * Updates a remote table's entry with the provided data based on the entry's id.
     *
     * @param {string} table - The name of the table to update the data in.
     * @param {T & { id: string }} data - The data object containing the updated fields and the id of the entry to update.
     * @return {Promise<void>} A promise resolving to void upon successful update of the remote entry.
     *                         Throws an error if the update operation fails after retries.
     */
    async updateRemote<T>(table: string, data: T & { id: string }): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            const { error } = await this.supabase
                .from(table)
                .update(data)
                .eq('id', data.id);

            if (error) throw error;
            return true;
        });

        if (!result.success) {
            this.handleError(result.error, `Failed to update remote ${table}`);
        }
    }

    /**
     * Deletes a record from a remote table using the specified table name and record ID.
     *
     * @param {string} table - The name of the table from which the record should be deleted.
     * @param {string} id - The ID of the record to delete.
     * @return {Promise<void>} A promise that resolves when the deletion operation is complete.
     */
    async deleteRemote(table: string, id: string): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            const { error } = await this.supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        });

        if (!result.success) {
            this.handleError(result.error, `Failed to delete remote ${table}`);
        }
    }

    /**
     * Synchronizes data from a remote source into local storage.
     * It retrieves records from the specified table in the remote database,
     * optionally filtered by organization ID and/or updated since a certain timestamp,
     * and saves them locally.
     *
     * @param {string} table - The name of the table to sync from the remote database.
     * @param {string} [orgId] - Optional. The organization ID to filter records by.
     * @param {number} [since] - Optional. A timestamp to filter records that have been updated since this time.
     * @return {Promise<void>} A promise that resolves when the synchronization is complete.
     *                         The promise is rejected if there is an error during the synchronization process.
     */
    async syncFromRemote(table: string, orgId?: string, since?: number): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            let query = this.supabase.from(table).select('*');
            if (orgId) {
                query = query.eq('org_id', orgId);
            }

            if (since) {
                query = query.gt('updated_at', new Date(since).toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;
            if (data?.length) {
                await this.storage.bulkSave(table, data);
            }
            return data;
        });
        if (!result.success) {
            this.handleError(result.error, `Failed to sync ${table} from remote`);
        }
    }

    /**
     * Synchronizes pending operations to the remote server. It retrieves all pending operations
     * sorted by timestamp, attempts to execute each operation, and handles successes and failures.
     * Successfully executed operations are removed from the pending list. Operations that fail
     * are logged and have their retry count incremented.
     *
     * @return {Promise<void>} A promise that resolves when the synchronization process is complete.
     *                         It does not resolve to any specific value but indicates completion.
     */
    async syncToRemote(): Promise<void> {
        try {
            const pendingOps = await this.storage.getPendingOperationsOrderedByTimestamp();
            const failedOperations: PendingOperation[] = [];

            for (const op of pendingOps) {
                const result = await this.executePendingOperation(op);

                if (result.success) {
                    await this.storage.deletePendingOperation(op.id);
                } else {
                    failedOperations.push(op);
                    // Update retry count
                    await this.storage.incrementOperationRetry(op.id);
                }
            }

            // Handle failed operations
            if (failedOperations.length > 0) {
                console.error(`${failedOperations.length} operations failed to sync`);
                // You could implement additional error handling or retry strategies here
            }
        } catch (error) {
            this.handleError(error, 'Failed to sync to remote');
        }
    }

    /**
     * Executes a pending operation with retry logic based on the specified operation type.
     *
     * @param {PendingOperation} op - The pending operation to be executed, containing the operation type and associated data.
     * @return {Promise<SyncResult<void>>} A promise that resolves to a SyncResult object indicating the success or failure of the operation execution.
     */
    private async executePendingOperation(op: PendingOperation): Promise<SyncResult<void>> {
        switch (op.type) {
            case 'create':
                return await this.executeWithRetry(() => this.createRemote(op.table, op.data));
            case 'update':
                return await this.executeWithRetry(() => this.updateRemote(op.table, op.data));
            case 'delete':
                return await this.executeWithRetry(() => this.deleteRemote(op.table, op.data.id));
            case 'upsert':
                return await this.executeWithRetry(() => this.upsertRemote(op.table, op.data));
            default:
                return {
                    success: false,
                    error: new Error(`Unknown operation type: ${op.type}`)
                };
        }
    }

    /**
     * Synchronizes the processed data entry with the database by upserting it
     * into the 'processed_data' table. The operation is retried on failure,
     * and an appropriate error handler is invoked if the synchronizing process fails.
     *
     * @param {ProcessedDataEntry} entry - The processed data entry to be upserted into the database.
     * @return {Promise<void>} A promise that resolves when the process is complete.
     */
    async syncProcessedData(entry: ProcessedDataEntry): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            const { data, error } = await this.supabase
                .from('processed_data')
                .upsert(entry);

            if (error) throw error;
            return data;
        });

        if (!result.success) {
            this.handleError(result.error, 'Failed to sync processed data');
        }
    }

    /**
     * Asynchronously inserts or updates a record in the specified remote table.
     *
     * @param {string} table - The name of the table where the record is to be upserted.
     * @param {T} data - The data to be upserted into the table.
     * @return {Promise<void>} A promise that resolves when the upsert operation is complete.
     *                          Rejection occurs if an error is encountered during the operation.
     */
    async upsertRemote<T>(table: string, data: T): Promise<void> {
        const result = await this.executeWithRetry(async () => {
            const { error } = await this.supabase
                .from(table)
                .upsert(data);

            if (error) throw error;
            return true;
        });

        if (!result.success) {
            this.handleError(result.error, `Failed to upsert remote ${table}`);
        }
    }

    /**
     * Verifies the synchronization of a record with the given id in the specified table.
     *
     * @param {string} table - The name of the table to query.
     * @param {string} id - The unique identifier of the record to verify.
     * @return {Promise<boolean>} A promise that resolves to true if the record is synchronized and exists; otherwise, false.
     */
    async verifySync(table: string, id: string): Promise<boolean> {
        const result = await this.executeWithRetry(async () => {
            const { data, error } = await this.supabase
                .from(table)
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data !== null;
        });

        return result.success && result.data === true;
    }
}