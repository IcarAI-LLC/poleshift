import { create } from 'zustand';
import { db } from '../powersync/db';
import type { SampleGroupMetadata } from '../types';
import type { DropboxConfigItem } from '../../config/dropboxConfig';

interface ProcessingState {
    progress: number;
    status: string;
}

interface ProcessStatus {
    isProcessing: boolean;
    progress: number;
    status: string;
    uploadProgress: number;
    downloadProgress: number;
    uploadStatus: string;
    downloadStatus: string;
}

interface ProcessState {
    // States
    processStatuses: Record<string, ProcessStatus>;
    processedData: Record<string, any>;
    error: string | null;

    // Process Actions
    processData: (
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        inputs: Record<string, any>,
        filePaths: string[],
        configItem: DropboxConfigItem,
        onSuccess: (insertData: any, configItem: DropboxConfigItem, processedData: any) => void,
        onError: (message: string) => void,
        orgId: string
    ) => Promise<void>;

    fetchProcessedData: (sampleGroup: SampleGroupMetadata) => Promise<void>;

    // Status Getters
    getProgressState: (sampleId: string, configId: string) => ProcessingState;
    getUploadDownloadProgressState: (sampleId: string, configId: string) => ProcessingState;

    // Status Setters
    updateProcessStatus: (key: string, updates: Partial<ProcessStatus>) => void;
    resetProcessStatus: (key: string) => void;
    setError: (error: string | null) => void;
}

const createDefaultProcessStatus = (): ProcessStatus => ({
    isProcessing: false,
    progress: 0,
    status: '',
    uploadProgress: 0,
    downloadProgress: 0,
    uploadStatus: '',
    downloadStatus: ''
});

export const useProcessStore = create<ProcessState>((set, get) => ({
    // Initial State
    processStatuses: {},
    processedData: {},
    error: null,

    // Process Data Action
    processData: async (
        processFunctionName,
        sampleGroup,
        inputs,
        filePaths,
        configItem,
        onSuccess,
        onError,
        orgId
    ) => {
        const key = `${sampleGroup.id}:${configItem.id}`;

        try {
            // Initialize processing state
            get().updateProcessStatus(key, {
                isProcessing: true,
                progress: 0,
                status: 'Starting process...',
                uploadProgress: 0,
                uploadStatus: 'Preparing upload...'
            });

            // Check for existing processed data
            const existingData = await db.execute(`
                SELECT * FROM processed_data 
                WHERE sample_id = ? AND config_id = ?
                AND status = 'completed'
            `, [sampleGroup.id, configItem.id]);

            if (existingData.length > 0) {
                get().updateProcessStatus(key, {
                    status: 'Data already processed',
                    progress: 100
                });
                return;
            }

            // Simulate file upload progress
            for (let i = 0; i < filePaths.length; i++) {
                const progress = (i + 1) / filePaths.length * 100;
                get().updateProcessStatus(key, {
                    uploadProgress: progress,
                    uploadStatus: `Uploading file ${i + 1} of ${filePaths.length}...`
                });
                await new Promise(resolve => setTimeout(resolve, 500)); // Simulate upload time
            }

            // Create processing record
            const timestamp = Date.now();
            const insertData = {
                key: `${sampleGroup.id}:${configItem.id}:${timestamp}`,
                config_id: configItem.id,
                data: JSON.stringify(inputs),
                raw_file_paths: JSON.stringify(filePaths),
                processed_path: null,
                timestamp,
                status: 'processing',
                metadata: JSON.stringify({}),
                sample_id: sampleGroup.id,
                human_readable_sample_id: sampleGroup.human_readable_sample_id,
                org_short_id: orgId,
                org_id: orgId
            };

            await db.execute(`
                INSERT INTO processed_data (
                    key, config_id, data, raw_file_paths, processed_path,
                    timestamp, status, metadata, sample_id, human_readable_sample_id,
                    org_short_id, org_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                insertData.key,
                insertData.config_id,
                insertData.data,
                insertData.raw_file_paths,
                insertData.processed_path,
                insertData.timestamp,
                insertData.status,
                insertData.metadata,
                insertData.sample_id,
                insertData.human_readable_sample_id,
                insertData.org_short_id,
                insertData.org_id
            ]);

            // Simulate processing steps
            const processingSteps = [
                'Validating data...',
                'Processing files...',
                'Analyzing results...',
                'Finalizing...'
            ];

            for (let i = 0; i < processingSteps.length; i++) {
                get().updateProcessStatus(key, {
                    progress: (i + 1) / processingSteps.length * 100,
                    status: processingSteps[i]
                });
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
            }

            // Update record status to completed
            await db.execute(`
                UPDATE processed_data 
                SET status = 'completed'
                WHERE key = ?
            `, [insertData.key]);

            // Final status update
            get().updateProcessStatus(key, {
                progress: 100,
                status: 'Processing complete',
                isProcessing: false
            });

            // Fetch and return updated data
            const updatedData = await get().fetchProcessedData(sampleGroup);

            if (onSuccess) {
                onSuccess(insertData, configItem, updatedData[key]);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Processing failed';
            set({ error: errorMessage });

            get().updateProcessStatus(key, {
                status: `Error: ${errorMessage}`,
                isProcessing: false
            });

            if (onError) {
                onError(errorMessage);
            }
        }
    },

    // Fetch Processed Data
    fetchProcessedData: async (sampleGroup: SampleGroupMetadata) => {
        try {
            const results = await db.execute(`
                SELECT * FROM processed_data 
                WHERE sample_id = ? AND status = 'completed'
                ORDER BY timestamp DESC
            `, [sampleGroup.id]);

            const processedData: Record<string, any> = {};
            results.forEach(result => {
                const key = `${result.sample_id}:${result.config_id}`;
                processedData[key] = {
                    ...result,
                    data: result.data ? JSON.parse(result.data) : null,
                    metadata: result.metadata ? JSON.parse(result.metadata) : null,
                    raw_file_paths: result.raw_file_paths ? JSON.parse(result.raw_file_paths) : null
                };
            });

            set({ processedData });
            return processedData;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch processed data';
            set({ error: errorMessage });
            throw error;
        }
    },

    // Status Getters
    getProgressState: (sampleId: string, configId: string) => {
        const key = `${sampleId}:${configId}`;
        const status = get().processStatuses[key] || createDefaultProcessStatus();
        return {
            progress: status.progress,
            status: status.status
        };
    },

    getUploadDownloadProgressState: (sampleId: string, configId: string) => {
        const key = `${sampleId}:${configId}`;
        const status = get().processStatuses[key] || createDefaultProcessStatus();
        const progress = (status.uploadProgress + status.downloadProgress) / 2;
        const currentStatus = status.uploadProgress < 100 ? status.uploadStatus : status.downloadStatus;

        return {
            progress,
            status: currentStatus
        };
    },

    // Status Setters
    updateProcessStatus: (key: string, updates: Partial<ProcessStatus>) => {
        set(state => ({
            processStatuses: {
                ...state.processStatuses,
                [key]: {
                    ...createDefaultProcessStatus(),
                    ...state.processStatuses[key],
                    ...updates
                }
            }
        }));
    },

    resetProcessStatus: (key: string) => {
        set(state => ({
            processStatuses: {
                ...state.processStatuses,
                [key]: createDefaultProcessStatus()
            }
        }));
    },

    setError: (error: string | null) => set({ error })
}));