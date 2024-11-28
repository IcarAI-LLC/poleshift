import { useContext, useCallback } from 'react';
import { type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { AppContext } from '../contexts/AppContext';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleGroupMetadata } from '../types';

// Types for progress tracking
interface ProgressState {
    progress: number;
    status: string;
}

interface ProcessCallback {
    (insertData: any, configItem: DropboxConfigItem, processedData: any): void;
}

// State interfaces
//@ts-ignore
interface ProcessedDataState {
    data: Record<string, any>;
    isProcessing: Record<string, boolean>;
    progressStates: Record<string, ProgressState>;
    uploadDownloadProgressStates: Record<string, ProgressState>;
    error: string | null;
}

export function useProcessedData() {
    const { state, dispatch, services } = useContext(AppContext);
    const { processedDataStorage, processedData: processedDataService, network } = services;

    const getProgressKey = useCallback((sampleId: string, configId: string): string => {
        return `${sampleId}:${configId}`;
    }, []);

    // Progress tracking functions
    const updateProgressState = useCallback((sampleId: string, configId: string, progress: number, status: string) => {
        dispatch({
            type: 'SET_PROCESSED_DATA_PROGRESS',
            payload: {
                key: getProgressKey(sampleId, configId),
                progress,
                status
            }
        });
    }, [dispatch, getProgressKey]);
//@ts-ignore
    const updateUploadDownloadProgressState = useCallback((sampleId: string, configId: string, progress: number, status: string) => {
        dispatch({
            type: 'SET_UPLOAD_DOWNLOAD_PROGRESS',
            payload: {
                key: getProgressKey(sampleId, configId),
                progress,
                status
            }
        });
    }, [dispatch, getProgressKey]);

    const getProgressState = useCallback((sampleId: string, configId: string): ProgressState => {
        const key = getProgressKey(sampleId, configId);
        return state.processedData.progressStates[key] || { progress: 0, status: '' };
    }, [state.processedData.progressStates, getProgressKey]);

    const getUploadDownloadProgressState = useCallback((sampleId: string, configId: string): ProgressState => {
        const key = getProgressKey(sampleId, configId);
        return state.processedData.uploadDownloadProgressStates[key] || { progress: 0, status: '' };
    }, [state.processedData.uploadDownloadProgressStates, getProgressKey]);

    // Updated processData function with Tauri 2.0 compatibility
    const processData = useCallback(async (
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        modalInputs: Record<string, string>,
        files: File[],
        configItem: DropboxConfigItem,
        onDataProcessed: ProcessCallback,
        onError: (message: string) => void,
    ) => {
        const sampleId = sampleGroup.human_readable_sample_id;
        const configId = configItem.id;
        const key = getProgressKey(sampleId, configId);

        try {
            dispatch({
                type: 'SET_PROCESSING_STATUS',
                payload: { key, status: true }
            });
            updateProgressState(sampleId, configId, 0, 'Starting process...');

            // Queue raw files first
            for (const file of files) {
                await processedDataStorage.queueRawFile(sampleId, configId, file);
            }

            updateProgressState(sampleId, configId, 20, 'Processing data...');

            let processedResult;
            if (network.isOnline()) {
                let unlisten: UnlistenFn | undefined;

                try {
                    // Set up event listener before invoking command
                    unlisten = await import('@tauri-apps/api/event').then(({ listen }) =>
                        listen('processing-progress', (event) => {
                            const { progress, status } = event.payload as { progress: number; status: string };
                            updateProgressState(sampleId, configId, progress, status);
                        })
                    );

                    // Invoke the command with proper type annotations
                    processedResult = await invoke<any>(configItem.processFunctionName, {
                        functionName: processFunctionName,
                        sampleId,
                        configId,
                        modalInputs,
                        files: files.map(f => ({ path: f, name: f.name }))
                    });
                } finally {
                    // Clean up event listener
                    if (unlisten) {
                        await unlisten();
                    }
                }
            } else {
                processedResult = {
                    data: { message: 'Offline processing simulation' },
                    timestamp: new Date().toISOString()
                };
            }

            await processedDataStorage.saveProcessedData(sampleId, configId, processedResult, {
                rawFilePaths: files.map(f => `${sampleGroup.storage_folder}/${f.name}`),
                metadata: {
                    processFunction: processFunctionName,
                    processedDateTime: new Date().toISOString()
                }
            });

            const processedBlob = new Blob([JSON.stringify(processedResult)], {
                type: 'application/json'
            });
            await processedDataStorage.queueProcessedFile(sampleId, configId, processedBlob);

            const metadata = {
                sampleId,
                configId,
                timestamp: Date.now(),
                status: 'processed'
            };

            dispatch({
                type: 'SET_PROCESSED_DATA',
                payload: {
                    key,
                    data: processedResult
                }
            });

            updateProgressState(sampleId, configId, 100, 'Processing complete');
            onDataProcessed(metadata, configItem, processedResult);

        } catch (error: any) {
            console.error('Processing error:', error);
            onError(error.message || 'Failed to process data');
            updateProgressState(sampleId, configId, 0, 'Processing failed');
        } finally {
            dispatch({
                type: 'SET_PROCESSING_STATUS',
                payload: { key, status: false }
            });
        }
    }, [dispatch, network, processedDataStorage, updateProgressState, getProgressKey]);

    // Fetch processed data implementation
    const fetchProcessedData = useCallback(async (sampleGroup: SampleGroupMetadata) => {
        if (!sampleGroup) return;

        try {
            const localData = await processedDataStorage.getAllProcessedData(sampleGroup.human_readable_sample_id);

            Object.entries(localData).forEach(([key, data]) => {
                dispatch({
                    type: 'SET_PROCESSED_DATA',
                    payload: { key, data }
                });
            });

            if (network.isOnline()) {
                await processedDataService.syncProcessedData(sampleGroup.human_readable_sample_id);
            }
        } catch (error) {
            console.error('Error fetching processed data:', error);
        }
    }, [dispatch, network, processedDataService, processedDataStorage]);

    return {
        processedData: state.processedData.data,
        isProcessing: state.processedData.isProcessing,
        processData,
        fetchProcessedData,
        getProgressState,
        getUploadDownloadProgressState
    };
}