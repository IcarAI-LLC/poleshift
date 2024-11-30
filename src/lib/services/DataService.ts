import { BaseService } from "./BaseService";
import { OperationQueue } from "./offline";
import { FileNode, SampleGroupMetadata, SampleLocation, SampleMetadata } from "../types";
import { SyncService } from "./SyncService";
import { IndexedDBStorage } from "../storage/IndexedDB";
import { networkService } from "./EnhancedNetworkService";
import { v4 as uuidv4 } from 'uuid';

export class DataService extends BaseService {
    protected storageKey: string = 'data';
    //@ts-ignore
    private readonly SYNC_RETRY_ATTEMPTS = 3;
    //@ts-ignore
    private readonly SYNC_RETRY_DELAY = 1000;

    constructor(
        private syncService: SyncService,
        private operationQueue: OperationQueue,
        readonly storage: IndexedDBStorage
    ) {
        super(storage);
    }

    private async attemptOnlineOperation<T>(
        operation: () => Promise<T>,
        fallback: () => Promise<void>
    ): Promise<void> { // Adjusted the return type to void
        if (await networkService.hasActiveConnection()) {
            try {
                await operation();
            } catch (error) {
                console.error('Online operation failed, enqueuing operation:', error);
                await fallback();
            }
        } else {
            await fallback();
        }
    }


    async createSampleGroup(data: Partial<SampleGroupMetadata>): Promise<SampleGroupMetadata> {
        try {
            const newSampleGroup: SampleGroupMetadata = {
                ...data as SampleGroupMetadata,
                id: data.id || uuidv4(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Save locally first
            await this.storage.saveSampleGroup(newSampleGroup);

            // Attempt remote sync
            await this.attemptOnlineOperation(
                async () => await this.syncService.createRemote('sample_group_metadata', newSampleGroup),
                async () => await this.operationQueue.enqueue({
                    type: 'upsert',
                    table: 'sample_group_metadata',
                    data: newSampleGroup
                })
            );

            return newSampleGroup;
        } catch (error) {
            this.handleError(error, 'Failed to create sample group');
            throw error;
        }
    }

    async createFileNode(data: Partial<FileNode>): Promise<FileNode> {
        try {
            const newNode: FileNode = {
                ...data as FileNode,
                id: data.id || uuidv4(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Save locally first
            await this.storage.saveFileNode(newNode);

            // Attempt remote sync
            await this.attemptOnlineOperation(
                async () => await this.syncService.createRemote('file_nodes', newNode),
                async () => await this.operationQueue.enqueue({
                    type: 'create',
                    table: 'file_nodes',
                    data: newNode
                })
            );

            return newNode;
        } catch (error) {
            this.handleError(error, 'Failed to create file node');
            throw error;
        }
    }

    async saveSampleMetadata(data: SampleMetadata): Promise<void> {
        try {
            const metadata = {
                ...data,
                updated_at: new Date().toISOString()
            };

            await this.storage.saveSampleMetadata(metadata);

            await this.attemptOnlineOperation(
                async () => await this.syncService.upsertRemote('sample_metadata', metadata),
                async () => await this.operationQueue.enqueue({
                    type: 'upsert',
                    table: 'sample_metadata',
                    data: metadata
                })
            );
        } catch (error) {
            this.handleError(error, 'Failed to save sample metadata');
        }
    }

    async updateSampleGroup(id: string, updates: Partial<SampleGroupMetadata>): Promise<SampleGroupMetadata> {
        try {
            const existing = await this.storage.getSampleGroup(id);
            if (!existing) throw new Error('Sample group not found');

            const updatedGroup = {
                ...existing,
                ...updates,
                updated_at: new Date().toISOString()
            };

            await this.storage.saveSampleGroup(updatedGroup);

            await this.attemptOnlineOperation(
                async () => await this.syncService.updateRemote('sample_group_metadata', updatedGroup),
                async () => await this.operationQueue.enqueue({
                    type: 'update',
                    table: 'sample_group_metadata',
                    data: updatedGroup
                })
            );

            return updatedGroup;
        } catch (error) {
            this.handleError(error, 'Failed to update sample group');
            throw error;
        }
    }

    async updateFileTree(updatedTree: FileNode[]): Promise<void> {
        try {
            const timestamp = new Date().toISOString();
            const updatedNodes = updatedTree.map(node => ({
                ...node,
                updated_at: timestamp
            }));

            // Save all nodes locally first
            await Promise.all(updatedNodes.map(node => this.storage.saveFileNode(node)));

            // Attempt online sync for each node
            await Promise.all(updatedNodes.map(node =>
                this.attemptOnlineOperation(
                    async () => await this.syncService.updateRemote('file_nodes', node),
                    async () => await this.operationQueue.enqueue({
                        type: 'update',
                        table: 'file_nodes',
                        data: node
                    })
                )
            ));
        } catch (error) {
            this.handleError(error, 'Failed to update file tree');
        }
    }

    async deleteNode(nodeId: string): Promise<void> {
        try {
            const node = await this.storage.getFileNode(nodeId);
            if (!node) {
                throw new Error('Node not found');
            }

            // Perform local deletions
            await this.storage.deleteFileNode(nodeId);
            if (node.type === 'sampleGroup') {
                await this.storage.deleteSampleGroup(nodeId);
            }

            // Handle remote deletions
            const deleteOperations = [
                this.attemptOnlineOperation(
                    async () => await this.syncService.deleteRemote('file_nodes', nodeId),
                    async () => await this.operationQueue.enqueue({
                        type: 'delete',
                        table: 'file_nodes',
                        data: { id: nodeId }
                    })
                )
            ];

            if (node.type === 'sampleGroup') {
                deleteOperations.push(
                    this.attemptOnlineOperation(
                        async () => await this.syncService.deleteRemote('sample_group_metadata', nodeId),
                        async () => await this.operationQueue.enqueue({
                            type: 'delete',
                            table: 'sample_group_metadata',
                            data: { id: nodeId }
                        })
                    )
                );
            }

            await Promise.all(deleteOperations);
        } catch (error) {
            this.handleError(error, 'Failed to delete node');
        }
    }

    // Read operations - these prioritize local data for speed
    async getSampleGroups(orgId: string): Promise<SampleGroupMetadata[]> {
        try {
            const localData = await this.storage.getSampleGroupsByOrg(orgId);

            // If online, try to sync in the background
            if (await networkService.hasActiveConnection()) {
                this.syncService.syncFromRemote('sample_group_metadata', orgId)
                    .catch(error => console.error('Background sync failed:', error));
            }

            return localData;
        } catch (error) {
            this.handleError(error, 'Failed to get sample groups');
            return [];
        }
    }

    async getAllFileNodes(): Promise<FileNode[]> {
        try {
            const localData = await this.storage.getAllFileNodes();

            // Background sync if online
            if (await networkService.hasActiveConnection()) {
                this.syncService.syncFromRemote('file_nodes')
                    .catch(error => console.error('Background sync failed:', error));
            }

            return localData;
        } catch (error) {
            this.handleError(error, 'Failed to get all file nodes');
            return [];
        }
    }

    async getAllSampleGroups(): Promise<SampleGroupMetadata[]> {
        try {
            const localData = await this.storage.getAllSampleGroups();

            // Background sync if online
            if (await networkService.hasActiveConnection()) {
                this.syncService.syncFromRemote('sample_group_metadata')
                    .catch(error => console.error('Background sync failed:', error));
            }

            return localData;
        } catch (error) {
            this.handleError(error, 'Failed to get all sample groups');
            return [];
        }
    }

    async getFileNode(nodeId: string): Promise<FileNode | undefined> {
        try {
            return await this.storage.getFileNode(nodeId);
        } catch (error) {
            this.handleError(error, 'Failed to get file node');
            return undefined;
        }
    }

    async getAllSampleLocations(): Promise<SampleLocation[]> {
        try {
            const localData = await this.storage.getAllLocations();

            // Background sync if online
            if (await networkService.hasActiveConnection()) {
                this.syncService.syncFromRemote('sample_locations')
                    .catch(error => console.error('Background sync failed:', error));
            }

            return localData;
        } catch (error) {
            this.handleError(error, 'Failed to get all sample locations');
            return [];
        }
    }
}