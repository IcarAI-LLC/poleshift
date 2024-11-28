// lib/services/ProcessedDataService.ts

import { BaseService } from './BaseService';
import { NetworkService } from './offline';
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

interface ProcessCallback {
    (progress: number, status: string): void;
}

export class ProcessedDataService extends BaseService {
    protected storageKey: string = 'data';
    private uploadManager: UploadManager;

    constructor(
        private syncService: SyncService,
        private networkService: NetworkService,
        private operationQueue: OperationQueue,
        readonly storage: IndexedDBStorage,
    ) {
        super(storage);
        this.uploadManager = new UploadManager(this.networkService);
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
    ): Promise<any> {
        const humanReadableSampleId = sampleGroup.human_readable_sample_id;
        const configId = configItem.id;
        const sampleId = sampleGroup.id;
        const key = `${humanReadableSampleId}:${configId}`;

        try {
            // 1. Create initial metadata record
            const metadataRecord: SampleMetadata = {
                id: uuidv4(),
                human_readable_sample_id: humanReadableSampleId,
                org_id: sampleGroup.org_id,
                user_id: sampleGroup.user_id,
                data_type: configItem.dataType,
                status: 'processing',
                upload_datetime_utc: new Date().toISOString(),
                process_function_name: processFunctionName,
                sample_group_id: sampleGroup.id,
                raw_storage_paths: filePaths.map(file =>
                    `${sampleGroup.org_id}/${humanReadableSampleId}/${file.replace(/^.*[\\\/]/, '')}`
                ),
                processed_storage_path: `${sampleGroup.org_id}/${humanReadableSampleId}/processed/${configId}.json`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Save initial metadata to IndexedDB
            await this.storage.saveSampleMetadata(metadataRecord);

            // 2. Queue raw files for upload with correct paths
            for (const filePath of filePaths) {
                const fileName = filePath.replace(/^.*[\\\/]/, '');
                const storagePath = `${sampleGroup.org_id}/${humanReadableSampleId}/${fileName}`;

                const fileBuffer = await readFile(filePath);
                const file = new File([fileBuffer], fileName);
                await this.queueRawFile(humanReadableSampleId, configId, file, { customPath: storagePath });
            }

            // Start the upload process
            await this.uploadManager.startUploadProcess(onUploadProgress);

            // 3. Process the data using Tauri command
            onProcessProgress(0, 'Processing data...');

            let unlisten: UnlistenFn | undefined;
            let result: any;
            try {
                unlisten = await listen('progress', (event) => {
                    const { progress, status } = event.payload as { progress: number; status: string };
                    onProcessProgress(progress, status);
                });

                result = await invoke<any>(configItem.processFunctionName, {
                    functionName: processFunctionName,
                    sampleId: humanReadableSampleId,
                    modalInputs,
                    filePaths,
                });
            } finally {
                if (unlisten) {
                    await unlisten();
                }
            }

            // 4. Prepare and queue processed data
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

            await this.queueProcessedFile(humanReadableSampleId, configId, processedBlob, {
                customPath: metadataRecord.processed_storage_path,
            });

            // Trigger the upload process after queuing processed data
            await this.uploadManager.startUploadProcess(onUploadProgress);

            // 5. Update metadata record with completion status
            const updatedMetadata: SampleMetadata = {
                ...metadataRecord,
                status: 'processed',
                processed_datetime_utc: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            await this.storage.saveSampleMetadata(updatedMetadata);


            await this.storage.saveProcessedData(sampleId, configId, processedData, orgId, humanReadableSampleId,  {
                rawFilePaths: metadataRecord.raw_storage_paths || undefined,
                processedPath: metadataRecord.processed_storage_path,
                metadata: processedData.metadata,
            });

            onProcessProgress(100, 'Processing complete');
            return processedData;
        } catch (error) {
            this.handleError(error, 'Failed to process data');
            throw error;
        }
    }

    // Add these methods to fix the TypeScript errors

    // Queue raw file for upload
    async queueRawFile(
        humanReadableSampleId: string,
        configId: string,
        file: File,
        options: { customPath?: string } = {}
    ): Promise<void> {
        await this.storage.queueRawFile(humanReadableSampleId, configId, file, options);
    }

    // Queue processed file for upload
    async queueProcessedFile(
        humanReadableSampleId: string,
        configId: string,
        data: Blob,
        options: { customPath?: string } = {}
    ): Promise<void> {
        await this.storage.queueProcessedFile(humanReadableSampleId, configId, data, options);
    }


    async getProcessedData(humanReadableSampleId: string, configId: string): Promise<any> {
        try {
            return await this.storage.getProcessedData(humanReadableSampleId, configId);
        } catch (error) {
            this.handleError(error, 'Failed to get processed data');
        }
    }

    async getAllProcessedData(humanReadableSampleId: string): Promise<Record<string, ProcessedDataEntry>> {
        try {
            const data = await this.storage.getAllProcessedData(humanReadableSampleId);
            return data;
        } catch (error) {
            console.error('Detailed error:', error);
            throw new Error('Failed to get all processed data');
        }
    }


    async syncProcessedData(humanReadableSampleId: string): Promise<void> {
        console.log("Processed data service called sync on", humanReadableSampleId);
        if (!this.networkService.isOnline()) return;

        try {
            const localData = await this.getAllProcessedData(humanReadableSampleId);
            console.log("Local data: ", localData);
            // Sync each piece of processed data
            for (const entry of Object.values(localData)) {
                await this.syncService.syncProcessedData(entry);
            }
        } catch (error) {
            console.log(error);
            this.handleError(error, 'Failed to sync processed data');
        }
    }
}
