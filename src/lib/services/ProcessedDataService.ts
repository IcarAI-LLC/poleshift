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

interface ProcessCallback {
    (progress: number, status: string): void;
}

interface ProcessResult {
    success: boolean;
    data?: any;
    error?: Error;
}

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

    async getProcessedData(sampleId: string, configId: string): Promise<any> {
        return this.withRetry(
            () => this.storage.getProcessedData(sampleId, configId),
            'Failed to get processed data'
        );
    }

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
