// src/lib/stores/processStore.ts

import { create } from 'zustand';
import { db } from '../powersync/db';
import type { SampleGroupMetadata } from '../types';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { v4 as uuidv4} from 'uuid';

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
        filePaths: string[], // Local file paths
        configItem: DropboxConfigItem,
        onSuccess: (result: any, configItem: DropboxConfigItem, processedData: any) => void,
        onError: (message: string) => void,
        orgId: string,
        orgId: string,
        uploadedRawPaths?: string[] // Add this parameter
    ) => Promise<void>;

    fetchProcessedData: (sampleGroup: SampleGroupMetadata) => Promise<void>;

    // Retry helper
    withRetry: (
        operation: () => Promise<any>,
        maxAttempts: number,
        delayMs: number
    ) => Promise<any>;

    // Data persistence
    saveProcessedData: (
        id: string,
        sampleId: string,
        configId: string,
        processFunctionName: string,
        data: any,
        rawFilePaths: string[],
        processedFilePaths: string[],
        metadata: any,
        orgId: string,
        orgShortId: string,
        humanReadableSampleId: string,
        processedPath: string
    ) => Promise<void>;

    // Status Getters
    getProgressState: (sampleId: string, configId: string) => ProcessingState;
    getUploadDownloadProgressState: (sampleId: string, configId: string) => ProcessingState;

    // Status Setters
    updateProcessStatus: (key: string, updates: Partial<ProcessStatus>) => void;
    resetProcessStatus: (key: string) => void;
    setError: (error: string | null) => void;
}

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000;

const createDefaultProcessStatus = (): ProcessStatus => ({
    isProcessing: false,
    progress: 0,
    status: '',
    uploadProgress: 0,
    downloadProgress: 0,
    uploadStatus: '',
    downloadStatus: '',
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
        orgId,
        uploadedRawPaths
    ) => {
        const key = `${sampleGroup.id}:${configItem.id}`;
        let progressUnlisten: UnlistenFn | undefined;

        try {
            // Initialize processing state
            get().updateProcessStatus(key, {
                isProcessing: true,
                progress: 0,
                status: 'Starting process...',
            });

            // Set up progress listener
            progressUnlisten = await listen('progress', (event) => {
                const { progress, status } = event.payload;
                get().updateProcessStatus(key, { progress, status });
            });

            // Process with retry logic
            const result = await get().withRetry(
                () =>
                    invoke(processFunctionName, {
                        sampleId: sampleGroup.id,
                        modalInputs: inputs,
                        filePaths,
                    }),
                DEFAULT_RETRY_ATTEMPTS,
                DEFAULT_RETRY_DELAY
            );

            // Prepare additional data for saving
            const processedFilePaths = result.processedFilePaths || [];
            const metadata = result.metadata || {};
            const processedPath = result.processedPath || '';
            const humanReadableSampleId = sampleGroup.human_readable_id || sampleGroup.id;
            const sampleOrgId = sampleGroup.org_id || null;
            const orgShortId = orgId || null;
            let id = uuidv4()

            // Save to database
            await get().saveProcessedData(
                id,
                sampleGroup.id,
                configItem.id,
                processFunctionName,
                result,
                uploadedRawPaths || [],
                processedFilePaths,
                metadata,
                sampleOrgId,
                orgShortId,
                humanReadableSampleId,
                processedPath
            );

            // Fetch and update processed data
            await get().fetchProcessedData(sampleGroup);

            // Final status update
            get().updateProcessStatus(key, {
                progress: 100,
                status: 'Processing complete',
                isProcessing: false,
            });

            if (onSuccess) {
                onSuccess(result, configItem, get().processedData[key]);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Processing failed';
            set({ error: errorMessage });

            get().updateProcessStatus(key, {
                status: `Error: ${errorMessage}`,
                isProcessing: false,
            });

            if (onError) {
                onError(errorMessage);
            }
        } finally {
            if (progressUnlisten) {
                await progressUnlisten();
            }
        }
    },


    // Retry helper
    withRetry: async (operation, maxAttempts, delayMs) => {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxAttempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
                }
            }
        }

        throw lastError || new Error('Processing failed after retries');
    },

    // Save processed data to database
    saveProcessedData: async (
        id: string,
        sampleId: string,
        configId: string,
        processFunctionName: string,
        data: any,
        rawFilePaths: string[],
        processedFilePaths: string[], // New parameter
        metadata: any,                // New parameter
        orgId: string,                // New parameter
        orgShortId: string,           // New parameter
        humanReadableSampleId: string,// New parameter
        processedPath: string         // New parameter
    ) => {
        const timestamp = Date.now();
        await db.execute(
            `
                INSERT INTO processed_data (
                    key,
                    id,
                    sample_id,
                    human_readable_sample_id,
                    config_id,
                    data,
                    raw_file_paths,
                    processed_file_paths,
                    processed_path,
                    timestamp,
                    status,
                    metadata,
                    org_id,
                    org_short_id,
                    process_function_name
                ) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                `${sampleId}:${configId}:${timestamp}`,
                `${sampleId}:${configId}:${timestamp}`,
                sampleId,
                humanReadableSampleId,
                configId,
                JSON.stringify(data),
                JSON.stringify(rawFilePaths),
                JSON.stringify(processedFilePaths),
                processedPath,
                timestamp,
                'completed',
                JSON.stringify(metadata),
                orgId,
                orgShortId,
                processFunctionName
            ]
        );
    },


    // Fetch Processed Data
    fetchProcessedData: async (sampleGroup) => {
        try {
            const results = await db.getAll(
                `
        SELECT * FROM processed_data 
        WHERE sample_id = ? AND status = 'completed'
        ORDER BY timestamp DESC
      `,
                [sampleGroup.id]
            );

            const processedData: Record<string, any> = {};
            results.forEach((result) => {
                const key = `${result.sample_id}:${result.config_id}`;
                processedData[key] = {
                    ...result,
                    data: result.data ? JSON.parse(result.data) : null,
                    metadata: result.metadata ? JSON.parse(result.metadata) : null,
                    raw_file_paths: result.raw_file_paths ? JSON.parse(result.raw_file_paths) : null,
                };
            });

            set({ processedData });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch processed data';
            set({ error: errorMessage });
            throw error;
        }
    },

    // Status Getters
    getProgressState: (sampleId, configId) => {
        const key = `${sampleId}:${configId}`;
        const status = get().processStatuses[key] || createDefaultProcessStatus();
        return {
            progress: status.progress,
            status: status.status,
        };
    },

    getUploadDownloadProgressState: (sampleId, configId) => {
        const key = `${sampleId}:${configId}`;
        const status = get().processStatuses[key] || createDefaultProcessStatus();
        const progress = (status.uploadProgress + status.downloadProgress) / 2;
        const currentStatus =
            status.uploadProgress < 100 ? status.uploadStatus : status.downloadStatus;

        return {
            progress,
            status: currentStatus,
        };
    },

    // Status Setters
    updateProcessStatus: (key, updates) => {
        set((state) => ({
            processStatuses: {
                ...state.processStatuses,
                [key]: {
                    ...createDefaultProcessStatus(),
                    ...state.processStatuses[key],
                    ...updates,
                },
            },
        }));
    },

    resetProcessStatus: (key) => {
        set((state) => ({
            processStatuses: {
                ...state.processStatuses,
                [key]: createDefaultProcessStatus(),
            },
        }));
    },

    setError: (error) => set({ error }),
}));
