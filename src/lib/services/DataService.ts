import { BaseService } from "./BaseService";
import { OperationQueue } from "./offline";
import { FileNode, SampleGroupMetadata, SampleLocation, SampleMetadata } from "../types";
import { SyncService } from "./SyncService";
import { IndexedDBStorage } from "../storage/IndexedDB";
import { networkService } from "./EnhancedNetworkService";
import { v4 as uuidv4 } from 'uuid';
import {ProcessedDataService} from "./ProcessedDataService.ts";

/**
 * The DataService class provides various methods to interact with local and remote storage
 * for handling sample group metadata and file nodes. It extends the BaseService class,
 * utilizing services such as SyncService, OperationQueue, and IndexedDBStorage.
 *
 * This class is responsible for performing operations such as creating, updating, and deleting
 * sample groups and file nodes, with the capability to sync with a remote service when possible.
 * It ensures operations can be enqueued for later execution if offline, attempting retries upon failures.
 */
export class DataService extends BaseService {
    protected storageKey: string = 'data';
    //@ts-ignore
    private readonly SYNC_RETRY_ATTEMPTS = 3;
    //@ts-ignore
    private readonly SYNC_RETRY_DELAY = 1000;

    constructor(
        private syncService: SyncService,
        private operationQueue: OperationQueue,
        readonly storage: IndexedDBStorage,
        private processedService: ProcessedDataService,
    ) {
        super(storage);
    }

    /**
     * Tries to perform an online operation if there is an active network connection.
     * If the online operation fails or there is no connection, executes a fallback operation.
     *
     * @param {() => Promise<T>} operation - A function representing the online operation to attempt. It should return a promise.
     * @param {() => Promise<void>} fallback - A function representing the fallback operation to execute if the online operation fails or there is no connection. It should return a promise.
     * @return {Promise<void>} A promise that resolves when the attempt or fallback operation completes.
     */
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


    /**
     * Creates a new sample group with the provided metadata and attempts to sync it remotely.
     *
     * @param {Partial<SampleGroupMetadata>} data - Partial data for the sample group metadata. This can include properties to override default values.
     * @return {Promise<SampleGroupMetadata>} A promise that resolves to the newly created sample group metadata.
     */
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

    /**
     * Creates a new file node with the provided data, saves it locally, and attempts to sync it remotely.
     *
     * @param {Partial<FileNode>} data - Partial data to initialize the file node. If 'id' is not provided, a new UUID is generated.
     * @return {Promise<FileNode>} A promise that resolves to the created FileNode containing both initial data and generated timestamps.
     */
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

    /**
     * Saves the sample metadata by updating the local storage and attempting to sync with a remote service.
     *
     * @param {SampleMetadata} data - The sample metadata to be saved. This object will be enriched with the current timestamp before being stored.
     * @return {Promise<void>} A promise that resolves when the operation is complete, indicating that the metadata has been saved successfully.
     *                          If an error occurs during the process, it will be handled by logging the failure message.
     */
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

    /**
     * Updates an existing sample group with the given partial updates.
     *
     * @param {string} id - The unique identifier of the sample group to update.
     * @param {Partial<SampleGroupMetadata>} updates - An object containing the fields to update in the sample group.
     * @return {Promise<SampleGroupMetadata>} A promise that resolves to the updated sample group metadata.
     * @throws Will throw an error if the sample group cannot be found or if an error occurs during the update process.
     */
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

    /**
     * Updates the file tree with the provided nodes. This involves saving the nodes
     * locally and attempting to sync the updates online. Each node is timestamped
     * with the current date and time before being processed.
     *
     * @param {FileNode[]} updatedTree - An array of file nodes representing the updated
     * structure of the file tree. Each node will be augmented with a timestamp
     * indicating when it was updated.
     * @return {Promise<void>} A promise that resolves when the file tree has been
     * successfully updated both locally and, if possible, online. The promise is
     * rejected if an error occurs during the update process.
     */
    async updateFileTree(updatedTree: FileNode[]): Promise<void> {
        console.log("Updating file tree");
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
                    async () => await this.syncService.upsertRemote('file_nodes', node),
                    async () => await this.operationQueue.enqueue({
                        type: 'upsert',
                        table: 'file_nodes',
                        data: node
                    })
                )
            ));
        } catch (error) {
            this.handleError(error, 'Failed to update file tree');
        }
    }

    /**
     * Deletes a node identified by the specified nodeId from the local storage and remote database.
     *
     * This method deletes the node and all relevant metadata from the local storage. If the node is
     * identified as a sample group, it will also delete associated sample metadata and processed data.
     * The deletions are then attempted on the remote database through asynchronous operations, with
     * failed operations being queued for later retry.
     *
     * @param {string} nodeId - The unique identifier of the node to delete.
     * @return {Promise<void>} A promise that resolves with no value if the operation is successful.
     * @throws {Error} If the node does not exist or if any deletion operation fails.
     */
    async deleteNode(nodeId: string): Promise<void> {
        try {
            const node = await this.storage.getFileNode(nodeId);
            if (!node) {
                throw new Error('Node not found');
            }

            // Perform local deletions
            await this.storage.deleteFileNode(nodeId);

            const deleteOperations = [];

            if (node.type === 'sampleGroup') {
                // Delete sample group locally
                await this.storage.deleteSampleGroup(nodeId);

                // Get all sample metadata entries associated with the sample group
                const sampleMetadataEntries = await this.storage.getSampleMetadataBySampleGroupId(nodeId);

                for (const sampleMetadata of sampleMetadataEntries) {
                    const sampleId = sampleMetadata.id;

                    // Delete processedDataEntries locally
                    await this.processedService.deleteProcessedDataForSample(sampleId);

                    // Delete sample metadata locally
                    await this.storage.deleteSampleMetadata(sampleId);

                    // Delete processedDataEntries in Supabase
                    const processedDataEntries = await this.processedService.getAllProcessedData(sampleId);

                    for (const key in processedDataEntries) {
                        const processedDataEntry = processedDataEntries[key];

                        deleteOperations.push(
                            this.attemptOnlineOperation(
                                async () => await this.syncService.deleteRemote('processed_data', processedDataEntry.key),
                                async () => await this.operationQueue.enqueue({
                                    type: 'delete',
                                    table: 'processed_data',
                                    data: { key: processedDataEntry.key }
                                })
                            )
                        );
                    }

                    // Also delete sample metadata in Supabase
                    deleteOperations.push(
                        this.attemptOnlineOperation(
                            async () => await this.syncService.deleteRemote('sample_metadata', sampleId),
                            async () => await this.operationQueue.enqueue({
                                type: 'delete',
                                table: 'sample_metadata',
                                data: { id: sampleId }
                            })
                        )
                    );
                }

                // Delete sample_group_metadata in Supabase
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

            // Handle remote deletion of the file node
            deleteOperations.push(
                this.attemptOnlineOperation(
                    async () => await this.syncService.deleteRemote('file_nodes', nodeId),
                    async () => await this.operationQueue.enqueue({
                        type: 'delete',
                        table: 'file_nodes',
                        data: { id: nodeId }
                    })
                )
            );

            await Promise.all(deleteOperations);
        } catch (error) {
            this.handleError(error, 'Failed to delete node');
        }
    }


    // Read operations - these prioritize local data for speed
    /**
     * Retrieves the sample group metadata associated with a specified organization.
     * Attempts to synchronize data from remote if an active network connection is available.
     *
     * @param {string} orgId - The unique identifier of the organization.
     * @return {Promise<SampleGroupMetadata[]>} A promise that resolves to an array of sample group metadata.
     */
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

    /**
     * Retrieves all file nodes from local storage, and initiates a background sync if there is an active network connection.
     * In case of an error during retrieval, an empty array is returned after handling the error.
     *
     * @return {Promise<FileNode[]>} A promise that resolves to an array of FileNode objects.
     */
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

    /**
     * Retrieves all sample groups metadata from local storage and attempts a background synchronization if
     * an active network connection is available. In case of any errors during the retrieval, it logs the
     * error and returns an empty array.
     *
     * @return {Promise<SampleGroupMetadata[]>} A promise that resolves to an array of sample group metadata.
     */
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

    /**
     * Retrieves the file node associated with the provided node ID.
     *
     * @param {string} nodeId - The unique identifier of the file node to be retrieved.
     * @return {Promise<FileNode|undefined>} A promise that resolves to the FileNode object if found, or undefined if an error occurs or the node is not found.
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
     * Retrieves all sample locations from the local storage and initiates a background sync
     * to update them from the remote source if there is an active network connection.
     *
     * @return {Promise<SampleLocation[]>} A promise that resolves to an array of sample locations.
     * If an error occurs, an empty array is returned.
     */
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