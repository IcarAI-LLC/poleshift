// lib/services/DataService.ts
import { BaseService } from "./BaseService.ts";
import { NetworkService, OperationQueue } from "./offline";
import { FileNode, SampleGroupMetadata, SampleLocation } from "../types";
import { SyncService } from "./SyncService.ts";
import { IndexedDBStorage } from "../storage/IndexedDB.ts"; // Removed @ts-ignore

export class DataService extends BaseService {
    protected storageKey: string = 'data';

    constructor(
        private syncService: SyncService,
        private networkService: NetworkService,
        private operationQueue: OperationQueue,
        readonly storage: IndexedDBStorage // Made storage a private member
    ) {
        super(storage);
    }

    // Existing Methods

    async createSampleGroup(data: Partial<SampleGroupMetadata>): Promise<void> {
        try {
            // Save locally first
            await this.storage.saveSampleGroup(data as SampleGroupMetadata);

            // Handle sync
            if (this.networkService.isOnline()) {
                await this.syncService.createRemote('sample_group_metadata', data);
            } else {
                await this.operationQueue.enqueue({
                    type: 'create',
                    table: 'sample_group_metadata',
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
            return []; // Return an empty array in case of error
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
                await this.syncService.updateRemote('sample_group_metadata', updatedGroup);
            } else {
                await this.operationQueue.enqueue({
                    type: 'update',
                    table: 'sample_group_metadata',
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
                await this.syncService.deleteRemote('sample_group_metadata', id);
            } else {
                await this.operationQueue.enqueue({
                    type: 'delete',
                    table: 'sample_group_metadata',
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
            return []; // Return an empty array in case of error
        }
    }

    async updateFileTree(updatedTree: FileNode[]): Promise<void> {
        try {
            // Update each node in the tree
            for (const node of updatedTree) {
                await this.storage.saveFileNode(node);
            }

            // If online, create/update each node individually
            if (this.networkService.isOnline()) {
                for (const node of updatedTree) {
                    await this.syncService.updateRemote('file_nodes', node);
                }
            } else {
                // Queue for later sync - one operation per node
                for (const node of updatedTree) {
                    await this.operationQueue.enqueue({
                        type: 'update',
                        table: 'file_nodes',
                        data: node
                    });
                }
            }
        } catch (error) {
            this.handleError(error, 'Failed to update file tree');
        }
    }

    async deleteNode(nodeId: string): Promise<void> {
        try {
            // Delete from local storage
            const node = await this.storage.getFileNode(nodeId);
            if (!node) {
                throw new Error('Node not found');
            }

            await this.storage.deleteFileNode(nodeId);

            // If the node is a sample group, delete the associated sample group
            if (node.type === 'sampleGroup') {
                await this.storage.deleteSampleGroup(nodeId);
            }

            // Handle sync for file_nodes
            if (this.networkService.isOnline()) {
                await this.syncService.deleteRemote('file_nodes', nodeId);
                if (node.type === 'sampleGroup') {
                    await this.syncService.deleteRemote('sample_group_metadata', nodeId);
                }
            } else {
                await this.operationQueue.enqueue({
                    type: 'delete',
                    table: 'file_nodes',
                    data: { id: nodeId }
                });
                if (node.type === 'sampleGroup') {
                    await this.operationQueue.enqueue({
                        type: 'delete',
                        table: 'sample_group_metadata',
                        data: { id: nodeId }
                    });
                }
            }
        } catch (error) {
            this.handleError(error, 'Failed to delete node');
        }
    }

    // New Methods

    /**
     * Fetches all file nodes without filtering by organization ID.
     * @returns Promise<FileNode[]>
     */
    async getAllFileNodes(): Promise<FileNode[]> {
        try {
            return await this.storage.getAllFileNodes();
        } catch (error) {
            this.handleError(error, 'Failed to get all file nodes');
            return []; // Return an empty array in case of error
        }
    }

    /**
     * Fetches all sample groups without filtering by organization ID.
     * @returns Promise<SampleGroupMetadata[]>
     */
    async getAllSampleGroups(): Promise<SampleGroupMetadata[]> {
        try {
            return await this.storage.getAllSampleGroups();
        } catch (error) {
            this.handleError(error, 'Failed to get all sample groups');
            return []; // Return an empty array in case of error
        }
    }

    /**
     * Fetches a single file node by ID.
     * @param nodeId string
     * @returns Promise<FileNode | undefined>
     */
    async getFileNode(nodeId: string): Promise<FileNode | undefined> {
        try {
            return await this.storage.getFileNode(nodeId);
        } catch (error) {
            this.handleError(error, 'Failed to get file node');
            return undefined;
        }
    }

    /**
     * Fetches all sample locations.
     * @returns Promise<SampleLocation[]>
     */
    async getAllSampleLocations(): Promise<SampleLocation[]> {
        try {
            return await this.storage.getAllLocations();
        } catch (error) {
            this.handleError(error, 'Failed to get all sample locations');
            return [];
        }
    }

    /**
     * Additional helper methods can be added here as needed.
     */
}
