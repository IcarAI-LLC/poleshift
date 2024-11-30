// ProcessedDataService.ts

import { BaseService } from './BaseService';
import { OperationQueue } from './offline';
import { SyncService } from './SyncService';
import type { SampleGroupMetadata, SampleMetadata } from '../types';
import { DropboxConfigItem } from '../../config/dropboxConfig';
import { IndexedDBStorage } from '../storage/IndexedDB';
import { ProcessedDataEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { readFile } from '@tauri-apps/plugin-fs';
import { UploadManager } from './UploadManager';
import { invoke } from '@tauri-apps/api/core';
import { UnlistenFn, listen } from '@tauri-apps/api/event';
import { networkService } from './EnhancedNetworkService';

/**
 * Represents a callback interface that is invoked to report the progress and status of a process.
 *
 * @callback ProcessCallback
 * @param {number} progress - A numeric value between 0 and 1 indicating the current progress of the process, where 0 represents no progress and 1 represents completion.
 * @param {string} status - A string providing a description of the current status or phase of the process.
 */
interface ProcessCallback {
    (progress: number, status: string): void;
}

/**
 * Represents the result of a process execution.
 *
 * This interface is used to encapsulate the outcome of a process,
 * providing information about whether the process was successful,
 * any resultant data from the process, and any error encountered during the process.
 *
 * @interface ProcessResult
 *
 * @property {boolean} success
 * A boolean indicating whether the process completed successfully.
 * A value of true means the process succeeded, while false indicates failure.
 *
 * @property {any} [data]
 * An optional property that contains the data resulting from a successful process.
 * This property may not be present if the process did not yield any data or if it failed.
 *
 * @property {Error} [error]
 * An optional property containing an error object if the process failed.
 * This property will not be present if the process was successful.
 */
interface ProcessResult {
    success: boolean;
    data?: any;
    error?: Error;
}

/**
 * Represents a service that processes data and manages file uploads
 * including handling metadata and operation retries.
 * Extends the BaseService to utilize base functionality for storage and sync.
 */
export class ProcessedDataService extends BaseService {
    protected storageKey: string = 'data';
    private uploadManager: UploadManager;
    private readonly RETRY_ATTEMPTS = 3;
    private readonly RETRY_DELAY = 1000;

    constructor(
        private syncService: SyncService,
        //@ts-ignore
        private operationQueue: OperationQueue,
        readonly storage: IndexedDBStorage,
    ) {
        super(storage);
        this.uploadManager = new UploadManager();
    }

    /**
     * Executes a given operation with retry logic. If the operation fails, it will be retried
     * a specified number of times with exponential backoff delay between attempts.
     *
     * @param operation A function that returns a promise, representing the operation to be executed.
     * @param errorMessage A string containing the error message to be used if all retry attempts fail.
     * @return A promise resolving to the result of the operation if successful.
     * @throws An error if all retry attempts fail, using either the last error encountered or the provided errorMessage.
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        errorMessage: string
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.RETRY_ATTEMPTS - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, attempt)));
                }
            }
        }

        throw lastError || new Error(errorMessage);
    }

    /**
     * Processes data by executing a specified function and handling related metadata, file uploads, and progress updates.
     *
     * @param {string} processFunctionName - The name of the function to be used for processing the data.
     * @param {SampleGroupMetadata} sampleGroup - Metadata for the sample group to be processed.
     * @param {Record<string, string>} modalInputs - A set of inputs required for the processing function.
     * @param {string[]} filePaths - Array of file paths that will be processed.
     * @param {DropboxConfigItem} configItem - Configuration details related to Dropbox for this process.
     * @param {ProcessCallback} onProcessProgress - Callback function to be called to update the progress of the processing.
     * @param {ProcessCallback} onUploadProgress - Callback function to be called to update the progress of the file upload.
     * @param {string} orgId - Identifier for the organization performing the process.
     * @return {Promise<ProcessResult>} A promise that resolves to the result of the process, containing success status and processed data.
     */
    async processData(
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        modalInputs: Record<string, string>,
        filePaths: string[],
        configItem: DropboxConfigItem,
        onProcessProgress: ProcessCallback,
        onUploadProgress: ProcessCallback,
        orgId: string
    ): Promise<ProcessResult> {
        const humanReadableSampleId = sampleGroup.human_readable_sample_id;
        const configId = configItem.id;
        const sampleId = sampleGroup.id;

        try {
            // 1. Create and save initial metadata record
            const metadataRecord = await this.createInitialMetadata(
                sampleGroup,
                configItem,
                processFunctionName,
                filePaths
            );
            await this.storage.saveSampleMetadata(metadataRecord);

            // 2. Queue raw files for upload
            await this.queueRawFiles(sampleGroup, sampleId, configId, filePaths);

            // 3. Process the data
            const result = await this.processDataWithProgress(
                configItem,
                processFunctionName,
                sampleId,
                modalInputs,
                filePaths,
                onProcessProgress
            );

            // 4. Handle processed data
            await this.handleProcessedData(
                result,
                sampleId,
                configId,
                metadataRecord,
                processFunctionName,
                onUploadProgress,
                orgId,
                humanReadableSampleId
            );

            return { success: true, data: result };
        } catch (error) {
            console.error('Processing error:', error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error('Failed to process data')
            };
        }
    }

    /**
     * Creates and initializes metadata for a sample with the provided parameters.
     *
     * @param {SampleGroupMetadata} sampleGroup - The metadata of the sample group to which the sample belongs.
     * @param {DropboxConfigItem} configItem - The configuration item containing details like data type.
     * @param {string} processFunctionName - The name of the process function to be associated with the sample.
     * @param {string[]} filePaths - An array of file paths to be included in the metadata.
     * @return {Promise<SampleMetadata>} A promise that resolves to the initial sample metadata object.
     */
    private async createInitialMetadata(
        sampleGroup: SampleGroupMetadata,
        configItem: DropboxConfigItem,
        processFunctionName: string,
        filePaths: string[]
    ): Promise<SampleMetadata> {
        return {
            id: uuidv4(),
            human_readable_sample_id: sampleGroup.human_readable_sample_id,
            org_id: sampleGroup.org_id,
            user_id: sampleGroup.user_id,
            data_type: configItem.dataType,
            status: 'processing',
            upload_datetime_utc: new Date().toISOString(),
            process_function_name: processFunctionName,
            sample_group_id: sampleGroup.id,
            raw_storage_paths: filePaths.map(file =>
                `${sampleGroup.org_id}/${sampleGroup.id}/${file.replace(/^.*[\\\/]/, '')}`
            ),
            processed_storage_path: `${sampleGroup.org_id}/${sampleGroup.id}/processed/${configItem.id}.json`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }

    /**
     * Queues raw files for later upload by associating them with a specific sample and configuration.
     * The files are not uploaded immediately; uploads will be attempted when the system is online.
     *
     * @param {SampleGroupMetadata} sampleGroup - Metadata containing information about the sample group, including organization ID.
     * @param {string} sampleId - The unique identifier for the sample to which the files belong.
     * @param {string} configId - The configuration identifier used in queuing the files.
     * @param {string[]} filePaths - The array of file paths pointing to the local files to be queued for uploading.
     * @return {Promise<void>} A promise that resolves when the files have been successfully queued.
     */
    private async queueRawFiles(
        sampleGroup: SampleGroupMetadata,
        sampleId: string,
        configId: string,
        filePaths: string[]
    ): Promise<void> {
        for (const filePath of filePaths) {
            const fileName = filePath.replace(/^.*[\\\/]/, '');
            const storagePath = `${sampleGroup.org_id}/${sampleId}/${fileName}`;

            const fileBuffer = await readFile(filePath);
            const file = new File([fileBuffer], fileName);
            await this.queueRawFile(sampleId, configId, file, { customPath: storagePath });
        }
        // Do not attempt to upload immediately; uploads will be attempted when online
    }

    /**
     * Processes data with progress tracking, invoking a specified function and reporting progress through a callback.
     *
     * @param {DropboxConfigItem} configItem - The configuration item that contains necessary settings for the process function.
     * @param {string} processFunctionName - The name of the process function to be invoked.
     * @param {string} sampleId - The identifier of the sample data to be processed.
     * @param {Record<string, string>} modalInputs - A map of input values required for the process, provided as key-value pairs.
     * @param {string[]} filePaths - An array of file paths that are relevant for the processing action.
     * @param {ProcessCallback} onProcessProgress - A callback function invoked with the progress and status of the processing.
     * @return {Promise<any>} A promise that resolves when the data processing is complete, containing the result of the operation.
     */
    private async processDataWithProgress(
        configItem: DropboxConfigItem,
        processFunctionName: string,
        sampleId: string,
        modalInputs: Record<string, string>,
        filePaths: string[],
        onProcessProgress: ProcessCallback
    ): Promise<any> {
        onProcessProgress(0, 'Processing data...');

        let unlisten: UnlistenFn | undefined;
        try {
            unlisten = await listen('progress', (event) => {
                const { progress, status } = event.payload as { progress: number; status: string };
                onProcessProgress(progress, status);
            });

            return await this.withRetry(
                () => invoke<any>(configItem.processFunctionName, {
                    functionName: processFunctionName,
                    sampleId,
                    modalInputs,
                    filePaths,
                }),
                'Data processing failed'
            );
        } finally {
            if (unlisten) {
                await unlisten();
            }
        }
    }

    /**
     * Handles the post-processing of data, saving the processed data, updating metadata,
     * and attempting to initiate the upload process if the network connection is active.
     *
     * @param {any} result - The data that has been processed.
     * @param {string} sampleId - Identifier for the sample being processed.
     * @param {string} configId - Configuration identifier relevant to the processing.
     * @param {SampleMetadata} metadataRecord - Metadata associated with the sample.
     * @param {string} processFunctionName - Name of the function used for processing the data.
     * @param {ProcessCallback} onUploadProgress - Callback function to track the progress of uploads.
     * @param {string} orgId - Identifier for the organization associated with the sample.
     * @param {string} humanReadableSampleId - Human-readable identifier for the sample.
     * @return {Promise<void>} A promise that resolves when the processing is complete and data is queued for upload or saved locally.
     */
    private async handleProcessedData(
        result: any,
        sampleId: string,
        configId: string,
        metadataRecord: SampleMetadata,
        processFunctionName: string,
        onUploadProgress: ProcessCallback,
        orgId: string,
        humanReadableSampleId: string
    ): Promise<void> {
        const processedData = {
            data: result,
            metadata: {
                processFunction: processFunctionName,
                processedDateTime: new Date().toISOString(),
            },
            rawFilePaths: metadataRecord.raw_storage_paths,
        };

        const processedBlob = new Blob([JSON.stringify(processedData)], {
            type: 'application/json',
        });

        await this.queueProcessedFile(sampleId, configId, processedBlob, {
            customPath: metadataRecord.processed_storage_path,
        });

        // Save processed data locally
        await this.storage.saveProcessedData(
            sampleId,
            configId,
            processedData,
            orgId,
            humanReadableSampleId,
            {
                rawFilePaths: metadataRecord.raw_storage_paths || undefined,
                processedPath: metadataRecord.processed_storage_path,
                metadata: processedData.metadata,
            }
        );

        // Update metadata to 'processed'
        const updatedMetadata: SampleMetadata = {
            ...metadataRecord,
            status: 'processed',
            processed_datetime_utc: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await this.storage.saveSampleMetadata(updatedMetadata);

        // Attempt to upload if online
        if (await networkService.hasActiveConnection()) {
            await this.uploadManager.startUploadProcess(onUploadProgress);
        } else {
            // Inform the user that uploads are pending due to offline status
            onUploadProgress(0, 'Uploads pending due to offline status');
        }
    }

    /**
     * Queues a raw file for processing by storing it in the storage system with the associated sample and configuration IDs.
     *
     * @param {string} sampleId - The identifier for the sample to which the file belongs.
     * @param {string} configId - The identifier for the configuration related to the file.
     * @param {File} file - The raw file to be queued for processing.
     * @param {Object} [options] - Optional parameters.
     * @param {string} [options.customPath] - A custom path where the file should be stored.
     * @return {Promise<void>} A promise that completes when the file has been successfully queued, or rejects if an error occurs.
     */
    async queueRawFile(
        sampleId: string,
        configId: string,
        file: File,
        options: { customPath?: string } = {}
    ): Promise<void> {
        await this.withRetry(
            () => this.storage.queueRawFile(sampleId, configId, file, options),
            'Failed to queue raw file'
        );
    }

    /**
     * Queues a processed file for storage and further processing.
     *
     * @param {string} sampleId - The identifier of the sample associated with the file.
     * @param {string} configId - The configuration identifier related to the file processing.
     * @param {Blob} data - The data blob of the processed file to be queued.
     * @param {Object} options - Optional parameters for additional customization.
     * @param {string} [options.customPath] - An optional custom path for storing the file.
     * @return {Promise<void>} A promise that resolves when the file has been successfully queued.
     */
    async queueProcessedFile(
        sampleId: string,
        configId: string,
        data: Blob,
        options: { customPath?: string } = {}
    ): Promise<void> {
        await this.withRetry(
            () => this.storage.queueProcessedFile(sampleId, configId, data, options),
            'Failed to queue processed file'
        );
    }

    /**
     * Retrieves processed data from storage based on the provided sample and configuration identifiers.
     *
     * @param {string} sampleId - The unique identifier for the sample.
     * @param {string} configId - The unique identifier for the configuration.
     * @return {Promise<any>} A promise that resolves to the processed data retrieved from storage.
     */
    async getProcessedData(sampleId: string, configId: string): Promise<any> {
        return this.withRetry(
            () => this.storage.getProcessedData(sampleId, configId),
            'Failed to get processed data'
        );
    }

    /**
     * Retrieves all processed data entries associated with the specified sample ID.
     *
     * This method attempts to fetch the processed data from the storage and retries the operation
     * if the initial attempt fails, logging an appropriate error message in case of failure.
     *
     * @param {string} sampleId - The unique identifier of the sample for which processed data is requested.
     * @return {Promise<Record<string, ProcessedDataEntry>>} A promise that resolves to an object
     * mapping keys to ProcessedDataEntry objects, representing the processed data entries.
     */
    async getAllProcessedData(sampleId: string): Promise<Record<string, ProcessedDataEntry>> {
        return this.withRetry(
            () => this.storage.getAllProcessedData(sampleId),
            'Failed to get all processed data'
        );
    }

    async syncProcessedData(sampleId: string): Promise<void> {
        if (!(await networkService.hasActiveConnection())) return;

        try {
            await this.syncService.syncToRemote();
            const localData = await this.getAllProcessedData(sampleId);

            await Promise.all(
                Object.values(localData).map(entry =>
                    this.withRetry(
                        () => this.syncService.syncProcessedData(entry),
                        `Failed to sync processed data for entry ${entry.key}`
                    )
                )
            );
        } catch (error) {
            this.handleError(error, 'Failed to sync processed data');
        }
    }
}
