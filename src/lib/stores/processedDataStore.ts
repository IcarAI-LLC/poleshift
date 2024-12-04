import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DropboxConfigItem } from '../../config/dropboxConfig';
import { SampleGroupMetadata, ProcessedDataEntry } from '../types';
import { storage } from '../services';
import { ProgressState } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface ProcessedDataState {
    data: Record<string, any>;
    isProcessing: Record<string, boolean>;
    error: string | null;
    processedData: Record<string, any>;
    progressStates: Record<string, ProgressState>;
    uploadDownloadProgressStates: Record<string, ProgressState>;
}

interface ProcessedDataActions {
    processData: (
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        modalInputs: Record<string, string>,
        filePaths: string[],
        configItem: DropboxConfigItem,
        onDataProcessed: (data: any) => void,
        onError: (message: string) => void,
        orgId: string
    ) => Promise<{ success: boolean; error?: Error }>;
    getProgressState: (sampleId: string, configId: string) => ProgressState;
    getUploadDownloadProgressState: (sampleId: string, configId: string) => ProgressState;
    fetchProcessedData: (sampleGroup: SampleGroupMetadata) => Promise<void>;
    deleteProcessedDataForSample: (sampleId: string) => Promise<void>;
    setError: (error: string | null) => void;
    updateProgress: (key: string, progress: number, status: string) => void;
    updateUploadDownloadProgress: (key: string, progress: number, status: string) => void;
}

const initialState: ProcessedDataState = {
    data: {},
    isProcessing: {},
    error: null,
    processedData: {},
    progressStates: {},
    uploadDownloadProgressStates: {},
};

export const useProcessedDataStore = create<ProcessedDataState & ProcessedDataActions>()(
    devtools(
        (set, get) => ({
            ...initialState,

            setError: (error) => set({ error }),

            updateProgress: (key: string, progress: number, status: string) =>
                set((state) => ({
                    progressStates: {
                        ...state.progressStates,
                        [key]: { progress, status }
                    }
                })),

            updateUploadDownloadProgress: (key: string, progress: number, status: string) =>
                set((state) => ({
                    uploadDownloadProgressStates: {
                        ...state.uploadDownloadProgressStates,
                        [key]: { progress, status }
                    }
                })),

            getProgressState: (sampleId: string, configId: string) => {
                const key = `${sampleId}:${configId}`;
                return get().progressStates[key] || { progress: 0, status: '' };
            },

            getUploadDownloadProgressState: (sampleId: string, configId: string) => {
                const key = `${sampleId}:${configId}`;
                return get().uploadDownloadProgressStates[key] || { progress: 0, status: '' };
            },

            processData: async (
                processFunctionName,
                sampleGroup,
                modalInputs,
                filePaths,
                configItem,
                onDataProcessed,
                onError,
                orgId
            ) => {
                const sampleId = sampleGroup.id;
                const configId = configItem.id;
                const key = `${sampleId}:${configId}`;

                let unlisten: UnlistenFn | undefined;

                try {
                    set((state) => ({
                        isProcessing: {
                            ...state.isProcessing,
                            [key]: true
                        }
                    }));

                    // Set up progress listener
                    unlisten = await listen('progress', (event) => {
                        const { progress, status } = event.payload as { progress: number; status: string };
                        get().updateProgress(key, progress, status);
                    });

                    // Process the data using Tauri command
                    const result = await invoke<any>(configItem.processFunctionName, {
                        functionName: processFunctionName,
                        sampleId,
                        modalInputs,
                        filePaths,
                    });

                    // Save processed data
                    await storage.saveProcessedData(
                        sampleId,
                        configId,
                        result,
                        orgId,
                        sampleGroup.human_readable_sample_id,
                        {
                            rawFilePaths: filePaths,
                            processedPath: `${orgId}/${sampleId}/processed/${configId}.json`,
                            metadata: {
                                processFunction: processFunctionName,
                                processedDateTime: new Date().toISOString(),
                            },
                        }
                    );

                    set((state) => ({
                        data: {
                            ...state.data,
                            [key]: result
                        },
                        isProcessing: {
                            ...state.isProcessing,
                            [key]: false
                        },
                        error: null
                    }));

                    onDataProcessed(result);
                    return { success: true };

                } catch (error: any) {
                    set((state) => ({
                        isProcessing: {
                            ...state.isProcessing,
                            [key]: false
                        },
                        error: error.message
                    }));

                    onError(error.message);
                    return { success: false, error };

                } finally {
                    if (unlisten) {
                        await unlisten();
                    }
                }
            },

            fetchProcessedData: async (sampleGroup) => {
                try {
                    const processedData = await storage.getAllProcessedData(sampleGroup.id);

                    set((state) => ({
                        processedData: {
                            ...state.processedData,
                            ...processedData
                        }
                    }));
                } catch (error: any) {
                    set({ error: error.message });
                    throw error;
                }
            },

            deleteProcessedDataForSample: async (sampleId) => {
                try {
                    const entries = await storage.getAllProcessedData(sampleId);
                    await Promise.all(
                        Object.values(entries).map(entry =>
                            storage.deleteProcessedData(sampleId, entry.config_id)
                        )
                    );

                    set((state) => {
                        const newProcessedData = { ...state.processedData };
                        Object.keys(entries).forEach((key) => {
                            delete newProcessedData[key];
                        });
                        return { processedData: newProcessedData };
                    });
                } catch (error: any) {
                    set({ error: error.message });
                    throw error;
                }
            }
        }),
        {
            name: 'processed-data-store'
        }
    )
);