// lib/services/ProcessedDataService.ts
import { BaseService } from './BaseService';
import { NetworkService } from './offline';
import { OperationQueue } from './offline';
import { SyncService } from './SyncService';
import type { SampleGroupMetadata } from '../types';
//@ts-ignore
import {IndexedDBStorage} from "../storage/IndexedDB";

interface ProcessCallback {
    (progress: number, status: string): void;
}

// Fix ProcessedDataService.ts constructor
export class ProcessedDataService extends BaseService {
    protected storageKey: string = 'processed';
    constructor(
        private syncService: SyncService,
        private networkService: NetworkService,
        private operationQueue: OperationQueue,
        storage: IndexedDBStorage
    ) {
        super(storage);
    }

    async processData(
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        modalInputs: Record<string, string>,
        files: File[],
        onProcessProgress: ProcessCallback,
        //@ts-ignore
        onUploadProgress: ProcessCallback
    ): Promise<any> {
        try {
            // Start processing
            onProcessProgress(0, 'Starting processing...');

            let processedData: any;

            // Handle different processing types
            switch (processFunctionName) {
                case 'handleCTDDataUpload':
                    processedData = await this.processCTDData(files[0], onProcessProgress);
                    break;
                case 'handleNutrientAmmoniaInput':
                    processedData = this.processNutrientData(modalInputs);
                    break;
                case 'handleSequencingData':
                    processedData = await this.processSequencingData(files, onProcessProgress);
                    break;
                default:
                    throw new Error(`Unknown process function: ${processFunctionName}`);
            }

            // Save processed data
            const sampleId = sampleGroup.human_readable_sample_id;
            const configId = processFunctionName;

            await this.saveProcessedData(sampleId, configId, processedData);

            onProcessProgress(100, 'Processing complete');
            return processedData;

        } catch (error) {
            this.handleError(error, 'Failed to process data');
        }
    }

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
                Date.now()
            );

            // Handle sync
            if (this.networkService.isOnline()) {
                await this.syncService.syncProcessedData(sampleId, configId, data);
            } else {
                await this.operationQueue.enqueue({
                    type: 'update',
                    table: 'processed_data',
                    data: { sampleId, configId, data }
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

    async getAllProcessedData(sampleId: string): Promise<Record<string, any>> {
        try {
            // Get all processed data for a sample
            const configTypes = ['ctd_data', 'nutrient_ammonia', 'sequencing_data'];
            const result: Record<string, any> = {};

            for (const configId of configTypes) {
                const data = await this.getProcessedData(sampleId, configId);
                if (data) {
                    result[`${sampleId}:${configId}`] = data;
                }
            }

            return result;
        } catch (error) {
            this.handleError(error, 'Failed to get all processed data');
        }
    }

    async syncProcessedData(sampleId: string): Promise<void> {
        if (!this.networkService.isOnline()) return;

        try {
            const localData = await this.getAllProcessedData(sampleId);

            // Sync each piece of processed data
            for (const [key, data] of Object.entries(localData)) {
                const [, configId] = key.split(':');
                await this.syncService.syncProcessedData(sampleId, configId, data);
            }
        } catch (error) {
            this.handleError(error, 'Failed to sync processed data');
        }
    }

    private async processCTDData(file: File, onProgress: ProcessCallback): Promise<any> {
        try {
            onProgress(0, 'Reading CTD file...');
            //@ts-ignore
            const fileContent = await this.readFile(file);

            onProgress(50, 'Processing CTD data...');
            // Add your CTD processing logic here

            onProgress(100, 'CTD processing complete');
            return {}; // Return processed data
        } catch (error) {
            this.handleError(error, 'Failed to process CTD data');
        }
    }

    private processNutrientData(inputs: Record<string, string>): any {
        try {
            const ammoniaValue = parseFloat(inputs.ammoniaValue);
            if (isNaN(ammoniaValue)) {
                throw new Error('Invalid ammonia value');
            }

            // Convert ammonia to ammonium
            const ammoniumValue = ammoniaValue * 1.05; // Example conversion factor

            return {
                ammoniaValue,
                ammoniumValue,
                timestamp: Date.now()
            };
        } catch (error) {
            this.handleError(error, 'Failed to process nutrient data');
        }
    }

    private async processSequencingData(files: File[], onProgress: ProcessCallback): Promise<any> {
        try {
            const totalFiles = files.length;
            let processedFiles = 0;

            const results = await Promise.all(files.map(async file => {
                onProgress(
                    (processedFiles / totalFiles) * 100,
                    `Processing file ${processedFiles + 1} of ${totalFiles}`
                );
                //@ts-ignore
                const fileContent = await this.readFile(file);
                // Add your sequencing data processing logic here

                processedFiles++;
                return {}; // Return processed data
            }));

            onProgress(100, 'Sequencing processing complete');
            return results;
        } catch (error) {
            this.handleError(error, 'Failed to process sequencing data');
        }
    }

    private readFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
}