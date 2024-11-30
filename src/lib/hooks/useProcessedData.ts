// useProcessedData.ts

import { useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useNetworkStatus } from './useNetworkStatus';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleGroupMetadata } from '../types';

/**
 * Represents the state of progress for a process or operation.
 *
 * @interface ProgressState
 *
 * @property {number} progress - The current progress expressed as a percentage (0 to 100).
 * @property {string} status - A descriptive status of the current state or stage of progress.
 */
interface ProgressState {
    progress: number;
    status: string;
}

/**
 * Defines a callback function signature used for processing data in conjunction
 * with a Dropbox configuration item.
 *
 * @callback ProcessCallback
 * @param {any} insertData - The data to be inserted or processed. The actual
 *                           structure and type depend on the implementation
 *                           context.
 * @param {DropboxConfigItem} configItem - An object representing configuration
 *                                          settings for Dropbox. This includes
 *                                          necessary parameters and options for
 *                                          processing the data.
 * @param {any} processedData - An object or data structure that holds the
 *                              processed results from previous operations. This
 *                              data is to be used or further transformed by the
 *                              implementation of the callback.
 *
 * This callback is intended to be implemented by the users of an interface or
 * library that provides integration or data processing capabilities with
 * Dropbox services or configurations. Implementations should define
 * specific behavior as needed for their use cases.
 */
interface ProcessCallback {
    (insertData: any, configItem: DropboxConfigItem, processedData: any): void;
}

/**
 * Provides functions and state management for processing and fetching data related to a sample group,
 * including the ability to track the progress of processing, uploading, and downloading tasks.
 *
 * @return {Object} An object containing the following properties and methods:
 *   - `processedData`: The current state of processed data, accessible as a key-value map.
 *   - `isProcessing`: A boolean indicating whether processing operations are currently in progress.
 *   - `processData`: A function to handle the processing of data with given parameters.
 *   - `fetchProcessedData`: A function to retrieve processed data, both locally and from a remote source.
 *   - `getProgressState`: A function to retrieve the current progress and status of a specific processing task.
 *   - `getUploadDownloadProgressState`: A function to retrieve the progress and status of upload/download operations for a specific task.
 */
export function useProcessedData() {
    const { state, dispatch, services } = useContext(AppContext);
    const { isOnline } = useNetworkStatus();

    const getProgressKey = useCallback((sampleId: string, configId: string): string => {
        return `${sampleId}:${configId}`;
    }, []);

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
            const sampleId = sampleGroup.id;
            const configId = configItem.id;
            const key = getProgressKey(sampleId, configId);

            try {
                dispatch({
                    type: 'SET_PROCESSING_STATUS',
                    payload: { key, status: true },
                });

                const result = await services.processedData.processData(
                    processFunctionName,
                    sampleGroup,
                    modalInputs,
                    filePaths,
                    configItem,
                    (progress, status) => {
                        updateProgressState(sampleId, configId, progress, status);
                    },
                    (progress, status) => {
                        updateUploadDownloadProgressState(sampleId, configId, progress, status);
                    },
                    orgId
                );

                if (!result.success) {
                    throw new Error(result.error?.message || 'Processing failed');
                }

                const processedData = result.data;

                // Update global state with processed data
                const dataKey = getProgressKey(sampleId, configId);
                dispatch({
                    type: 'SET_PROCESSED_DATA',
                    payload: { key: dataKey, data: processedData.data },
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
                // First get local data
                const localData = await services.processedData.getAllProcessedData(
                    sampleGroup.id
                );

                // Update state with local data
                Object.entries(localData).forEach(([key, value]) => {
                    const data = value.data.data;
                    dispatch({
                        type: 'SET_PROCESSED_DATA',
                        payload: { key, data },
                    });
                });

                // If online, sync with remote data
                if (isOnline) {
                    await services.processedData.syncProcessedData(sampleGroup.id);
                }
            } catch (error: any) {
                console.error('Error fetching processed data:', error);
                dispatch({
                    type: 'SET_ERROR_MESSAGE',
                    payload: error.message || 'Failed to fetch processed data',
                });
            }
        },
        [dispatch, services.processedData, isOnline]
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
