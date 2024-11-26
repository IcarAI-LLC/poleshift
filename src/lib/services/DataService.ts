// lib/services/DataService.ts
import {BaseService} from "./BaseService.ts";
import {NetworkService, OperationQueue} from "./offline";
import {SampleGroupMetadata, SampleLocation} from "../types";
import {SyncService} from "./SyncService.ts";
//@ts-ignore
import {IndexedDBStorage} from "../storage/IndexedDB.ts";

// Fix DataService.ts constructor
export class DataService extends BaseService {
    protected storageKey: string = 'data';
    constructor(
        private syncService: SyncService,
        private networkService: NetworkService,
        private operationQueue: OperationQueue,
        storage: IndexedDBStorage
    ) {
        super(storage);
    }

    async createSampleGroup(data: Partial<SampleGroupMetadata>): Promise<void> {
        try {
            // Save locally first
            await this.storage.saveSampleGroup(data as SampleGroupMetadata);

            // Handle sync
            if (this.networkService.isOnline()) {
                await this.syncService.createRemote('sampleGroups', data);
            } else {
                await this.operationQueue.enqueue({
                    type: 'create',
                    table: 'sampleGroups',
                    data
                });
            }
        } catch (error) {
            this.handleError(error, 'Failed to create sample group');
        }
    }

    async getSampleGroups(orgId: string): Promise<SampleGroupMetadata[]> {
        try {
            return await this.storage.getSampleGroupsByOrg(orgId);
        } catch (error) {
            this.handleError(error, 'Failed to get sample groups');
        }
    }

    async updateSampleGroup(id: string, updates: Partial<SampleGroupMetadata>): Promise<void> {
        try {
            const existing = await this.storage.getSampleGroup(id);
            if (!existing) throw new Error('Sample group not found');

            const updatedGroup = { ...existing, ...updates };

            // Update locally
            await this.storage.saveSampleGroup(updatedGroup);

            // Handle sync
            if (this.networkService.isOnline()) {
                await this.syncService.updateRemote('sampleGroups', updatedGroup);
            } else {
                await this.operationQueue.enqueue({
                    type: 'update',
                    table: 'sampleGroups',
                    data: updatedGroup
                });
            }
        } catch (error) {
            this.handleError(error, 'Failed to update sample group');
        }
    }

    async deleteSampleGroup(id: string): Promise<void> {
        try {
            // Delete locally
            await this.storage.deleteSampleGroup(id);

            // Handle sync
            if (this.networkService.isOnline()) {
                await this.syncService.deleteRemote('sampleGroups', id);
            } else {
                await this.operationQueue.enqueue({
                    type: 'delete',
                    table: 'sampleGroups',
                    data: { id }
                });
            }
        } catch (error) {
            this.handleError(error, 'Failed to delete sample group');
        }
    }

    async getLocations(): Promise<SampleLocation[]> {
        try {
            return await this.storage.getAllLocations();
        } catch (error) {
            this.handleError(error, 'Failed to get locations');
        }
    }
}