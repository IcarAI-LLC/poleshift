// src/hooks/useProcessedData.ts

import { useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleGroupMetadata } from '../types';

interface ProgressState {
    progress: number;
    status: string;
}

interface ProcessCallback {
    (insertData: any, configItem: DropboxConfigItem, processedData: any): void;
}

export function useProcessedData() {
    const { state, dispatch, services } = useContext(AppContext);

    const getProgressKey = useCallback((sampleId: string, configId: string): string => {
        return `${sampleId}:${configId}`;
    }, []);

    // Progress tracking functions
    const updateProgressState = useCallback(
        (sampleId: string, configId: string, progress: number, status: string) => {
            dispatch({
                type: 'SET_PROCESSED_DATA_PROGRESS',
                payload: {
                    key: getProgressKey(sampleId, configId),
                    progress,
                    status,
                },
            });
        },
        [dispatch, getProgressKey]
    );

    const updateUploadDownloadProgressState = useCallback(
        (sampleId: string, configId: string, progress: number, status: string) => {
            dispatch({
                type: 'SET_UPLOAD_DOWNLOAD_PROGRESS',
                payload: {
                    key: getProgressKey(sampleId, configId),
                    progress,
                    status,
                },
            });
        },
        [dispatch, getProgressKey]
    );

    const getProgressState = useCallback(
        (sampleId: string, configId: string): ProgressState => {
            const key = getProgressKey(sampleId, configId);
            return state.processedData.progressStates[key] || { progress: 0, status: '' };
        },
        [state.processedData.progressStates, getProgressKey]
    );

    const getUploadDownloadProgressState = useCallback(
        (sampleId: string, configId: string): ProgressState => {
            const key = getProgressKey(sampleId, configId);
            return state.processedData.uploadDownloadProgressStates[key] || { progress: 0, status: '' };
        },
        [state.processedData.uploadDownloadProgressStates, getProgressKey]
    );

    // Updated processData function
    const processData = useCallback(
        async (
            processFunctionName: string,
            sampleGroup: SampleGroupMetadata,
            modalInputs: Record<string, string>,
            filePaths: string[],
            configItem: DropboxConfigItem,
            onDataProcessed: ProcessCallback,
            onError: (message: string) => void,
            orgId: string
        ) => {
            const sampleId = sampleGroup.human_readable_sample_id;
            const configId = configItem.id;
            const key = getProgressKey(sampleId, configId);

            try {
                dispatch({
                    type: 'SET_PROCESSING_STATUS',
                    payload: { key, status: true },
                });

                // Call the service's processData method
                const processedData = await services.processedData.processData(
                    processFunctionName,
                    sampleGroup,
                    modalInputs,
                    filePaths,
                    configItem,
                    // onProcessProgress callback
                    (progress, status) => {
                        updateProgressState(sampleId, configId, progress, status);
                    },
                    // onUploadProgress callback
                    (progress, status) => {
                        updateUploadDownloadProgressState(sampleId, configId, progress, status);
                    },
                    orgId
                );

                // Update global state with processed data
                dispatch({
                    type: 'SET_PROCESSED_DATA',
                    payload: { key, data: processedData.data },
                });

                onDataProcessed(
                    {
                        sampleId,
                        configId,
                        timestamp: Date.now(),
                        status: 'processed',
                    },
                    configItem,
                    processedData
                );
            } catch (error: any) {
                console.error('Processing error:', error);
                onError(error.message || 'Failed to process data');
                updateProgressState(sampleId, configId, 0, 'Processing failed');
            } finally {
                dispatch({
                    type: 'SET_PROCESSING_STATUS',
                    payload: { key, status: false },
                });
            }
        },
        [
            dispatch,
            services.processedData,
            updateProgressState,
            updateUploadDownloadProgressState,
            getProgressKey,
        ]
    );

    const fetchProcessedData = useCallback(
        async (sampleGroup: SampleGroupMetadata) => {
            if (!sampleGroup) return;

            try {
                const localData = await services.processedData.getAllProcessedData(
                    sampleGroup.human_readable_sample_id
                );

                Object.entries(localData).forEach(([key, value]) => {
                    // Extract the actual data
                    const data = value.data.data; // Adjusted to extract the actual data
                    dispatch({
                        type: 'SET_PROCESSED_DATA',
                        payload: { key, data },
                    });
                });

                if (services.network.isOnline()) {
                    await services.processedData.syncProcessedData(sampleGroup.human_readable_sample_id);
                }
            } catch (error: any) {
                console.error('Error fetching processed data:', error);
                dispatch({
                    type: 'SET_ERROR_MESSAGE',
                    payload: error.message || 'Failed to fetch processed data',
                });
            }
        },
        [dispatch, services.network, services.processedData]
    );

    return {
        processedData: state.processedData.data,
        isProcessing: state.processedData.isProcessing,
        processData,
        fetchProcessedData,
        getProgressState,
        getUploadDownloadProgressState,
    };
}
