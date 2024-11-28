// lib/services/SyncService.ts
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseService} from "./BaseService.ts";
// @ts-ignore
import {IndexedDBStorage} from "../storage/IndexedDB.ts";
import {ProcessedDataEntry} from "../types";

// Fix SyncService.ts constructor
export class SyncService extends BaseService {
    protected storageKey: string = 'sync';

    constructor(
        public supabase: SupabaseClient,
        storage: IndexedDBStorage
    ) {
        super(storage);
    }

    async createRemote<T>(table: string, data: T): Promise<void> {
        try {
            const { error } = await this.supabase
                .from(table)
                .insert(data);

            if (error) throw error;
        } catch (error) {
            this.handleError(error, `Failed to create remote ${table}`);
        }
    }

    async updateRemote<T>(table: string, data: T & { id: string }): Promise<void> {
        try {
            const { error } = await this.supabase
                .from(table)
                .update(data)
                .eq('id', data.id);

            if (error) throw error;
        } catch (error) {
            this.handleError(error, `Failed to update remote ${table}`);
        }
    }

    async deleteRemote(table: string, id: string): Promise<void> {
        try {
            const { error } = await this.supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            this.handleError(error, `Failed to delete remote ${table}`);
        }
    }

    async syncFromRemote(table: string, orgId?: string, since?: number): Promise<void> {
        if (!orgId) {
            try {
                let query = this.supabase
                    .from(table)
                    .select('*')

                if (since) {
                    query = query.gt('updated_at', new Date(since).toISOString());
                }

                const {data, error} = await query;
                if (error) throw error;
                if (data?.length) {
                    await this.storage.bulkSave(table, data);
                }
            } catch (error) {
                this.handleError(error, `Failed to sync ${table} from remote`);
            }
        } else {
            try {
                let query = this.supabase
                    .from(table)
                    .select('*')
                    .eq('org_id', orgId);

                if (since) {
                    query = query.gt('updated_at', new Date(since).toISOString());
                }

                const {data, error} = await query;
                if (error) throw error;
                if (data?.length) {
                    await this.storage.bulkSave(table, data);
                }
            } catch (error) {
                this.handleError(error, `Failed to sync ${table} from remote`);
            }
        }
    }

    async syncToRemote(): Promise<void> {
        try {
            const pendingOps = await this.storage.getPendingOperationsOrderedByTimestamp();

            for (const op of pendingOps) {
                switch (op.type) {
                    case 'create':
                        await this.createRemote(op.table, op.data);
                        break;
                    case 'update':
                        await this.updateRemote(op.table, op.data);
                        break;
                    case 'delete':
                        await this.deleteRemote(op.table, op.data.id);
                        break;
                    case 'upsert':
                        await this.upsertRemote(op.table, op.data);
                        break;
                }

                await this.storage.deletePendingOperation(op.id);
            }
        } catch (error) {
            this.handleError(error, 'Failed to sync to remote');
        }
    }

    async syncProcessedData(entry: ProcessedDataEntry): Promise<void> {
        try {
            console.log("Syncing processed data: ", entry)
            const { data, error } = await this.supabase
                .from('processed_data')
                .upsert(entry);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log('Processed data synced:', data);
        } catch (error) {
            this.handleError(error, 'Failed to sync processed data');
        }
    }

    async upsertRemote<T>(table: string, data: T): Promise<void> {
        try {
            const { error } = await this.supabase
                .from(table)
                .upsert(data);

            if (error) throw error;
        } catch (error) {
            this.handleError(error, `Failed to upsert remote ${table}`);
        }
    }
}