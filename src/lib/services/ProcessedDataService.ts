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
import { SupabaseClient } from '@supabase/supabase-js';

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
        supabaseClient: SupabaseClient
    ) {
        super(storage);
        this.uploadManager = new UploadManager(supabaseClient, this.networkService);
    }

    async processData(
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        modalInputs: Record<string, string>,
        filePaths: string[],
        configItem: DropboxConfigItem,
        onProcessProgress: ProcessCallback,
        onUploadProgress: ProcessCallback
    ): Promise<any> {
        const sampleId = sampleGroup.human_readable_sample_id;
        const configId = configItem.id;
        const key = `${sampleId}:${configId}`;

        try {
            // 1. Create initial metadata record
            const metadataRecord: SampleMetadata = {
                id: uuidv4(),
                human_readable_sample_id: sampleId,
                org_id: sampleGroup.org_id,
                user_id: sampleGroup.user_id,
                data_type: configItem.dataType,
                status: 'processing',
                upload_datetime_utc: new Date().toISOString(),
                process_function_name: processFunctionName,
                sample_group_id: sampleGroup.id,
                raw_storage_paths: filePaths.map(file =>
                    `${sampleGroup.org_id}/${sampleId}/${file.replace(/^.*[\\\/]/, '')}`
                ),
                processed_storage_path: `${sampleGroup.org_id}/${sampleId}/processed/${configId}.json`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Save initial metadata to IndexedDB
            await this.storage.saveSampleMetadata(metadataRecord);

            // 2. Queue raw files for upload with correct paths
            for (const filePath of filePaths) {
                const fileName = filePath.replace(/^.*[\\\/]/, '');
                const storagePath = `${sampleGroup.org_id}/${sampleId}/${fileName}`;

                const fileBuffer = await readFile(filePath);
                const file = new File([fileBuffer], fileName);
                await this.queueRawFile(sampleId, configId, file, { customPath: storagePath });
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
                    sampleId,
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

            await this.queueProcessedFile(sampleId, configId, processedBlob, {
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

            // 6. Save processed data to local IndexedDB
            await this.storage.saveProcessedData(sampleId, configId, processedData, {
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
        sampleId: string,
        configId: string,
        file: File,
        options: { customPath?: string } = {}
    ): Promise<void> {
        await this.storage.queueRawFile(sampleId, configId, file, options);
    }

    // Queue processed file for upload
    async queueProcessedFile(
        sampleId: string,
        configId: string,
        data: Blob,
        options: { customPath?: string } = {}
    ): Promise<void> {
        await this.storage.queueProcessedFile(sampleId, configId, data, options);
    }

    // Existing methods...

    async saveProcessedData(
        sampleId: string,
        configId: string,
        data: any,
    ): Promise<void> {
        try {
            // Save locally first
            await this.storage.saveProcessedData(
                sampleId,
                configId,
                data,
            );

            // Handle sync
            if (this.networkService.isOnline()) {
                await this.syncService.syncProcessedData(sampleId, configId, data);
            } else {
                await this.operationQueue.enqueue({
                    type: 'update',
                    table: 'processed_data',
                    data: { sampleId, configId, data },
                });
            }
        } catch (error) {
            this.handleError(error, 'Failed to save processed data');
        }
    }

    async getProcessedData(sampleId: string, configId: string): Promise<any> {
        try {
            return await this.storage.getProcessedData(sampleId, configId);
        } catch (error) {
            this.handleError(error, 'Failed to get processed data');
        }
    }

    async getAllProcessedData(sampleId: string): Promise<Record<string, ProcessedDataEntry>> {
        try {
            const data = await this.storage.getAllProcessedData(sampleId);
            return data;
        } catch (error) {
            console.error('Detailed error:', error);
            throw new Error('Failed to get all processed data');
        }
    }


    async syncProcessedData(sampleId: string): Promise<void> {
        if (!this.networkService.isOnline()) return;

        try {
            const localData = await this.getAllProcessedData(sampleId);

            // Sync each piece of processed data
            for (const entry of Object.values(localData)) {
                const { sampleId, configId, data } = entry;
                await this.syncService.syncProcessedData(sampleId, configId, data);
            }
        } catch (error) {
            this.handleError(error, 'Failed to sync processed data');
        }
    }
}
