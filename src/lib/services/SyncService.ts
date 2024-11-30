import { SupabaseClient } from "@supabase/supabase-js";
import { BaseService } from "./BaseService";
import { IndexedDBStorage } from "../storage/IndexedDB";
import { ProcessedDataEntry, PendingOperation } from "../types";
import { networkService } from "./EnhancedNetworkService";

interface SyncOptions {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
}

interface SyncResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
}

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