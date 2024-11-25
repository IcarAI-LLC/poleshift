import React, { createContext, useCallback, useRef, useReducer } from 'react';
import { SampleGroup } from '../types';
import { DropboxConfigItem } from '../../config/dropboxConfig';
import { ProcessedDataContextType } from '../types/processed-data';
import { processedDataReducer, initialProcessedDataState } from './reducers/processedDataReducer';

export const ProcessedDataContext = createContext<ProcessedDataContextType | undefined>(undefined);

const getProgressKey = (sampleId: string, configId: string) => `${sampleId}:${configId}`;

export const ProcessedDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(processedDataReducer, initialProcessedDataState);
    const processingPromisesRef = useRef<Record<string, Promise<void>>>({});

    const updateProgressState = useCallback(
        (sampleId: string, configId: string, progress: number, status: string) => {
            dispatch({
                type: 'UPDATE_PROGRESS_STATE',
                sampleId,
                configId,
                progress,
                status,
            });
        },
        []
    );

    const updateUploadDownloadProgressState = useCallback(
        (sampleId: string, configId: string, progress: number, status: string) => {
            dispatch({
                type: 'UPDATE_UPLOAD_DOWNLOAD_PROGRESS_STATE',
                sampleId,
                configId,
                progress,
                status,
            });
        },
        []
    );

    const getProgressState = useCallback(
        (sampleId: string, configId: string) => {
            const key = getProgressKey(sampleId, configId);
            return state.progressStates[key] || { progress: 0, status: '' };
        },
        [state.progressStates]
    );

    const getUploadDownloadProgressState = useCallback(
        (sampleId: string, configId: string) => {
            const key = getProgressKey(sampleId, configId);
            return state.uploadDownloadProgressStates[key] || { progress: 0, status: '' };
        },
        [state.uploadDownloadProgressStates]
    );

    const setProcessingState = useCallback(
        (sampleId: string, configId: string, isProcessing: boolean) => {
            dispatch({
                type: 'SET_PROCESSING_STATE',
                sampleId,
                configId,
                isProcessing,
            });
        },
        []
    );

    const updateProcessedData = useCallback(
        (sampleId: string, configId: string, data: any) => {
            dispatch({
                type: 'UPDATE_PROCESSED_DATA',
                sampleId,
                configId,
                data,
            });
        },
        []
    );

    const processData = useCallback(async (
        _functionName: string,
        sampleGroup: SampleGroup,
        _modalInputs: Record<string, string>,
        _uploadedFiles: File[],
        configItem: DropboxConfigItem,
        _onDataProcessed: (insertData: any, configItem: DropboxConfigItem, processedData: any) => void,
        onError: (message: string) => void,
        // onProgress?: (progress: number, status: string) => void,
    ) => {
        const sampleId = sampleGroup.human_readable_sample_id;
        const configId = configItem.id;
        const key = getProgressKey(sampleId, configId);

        if (!processingPromisesRef.current[key]) {
            const processingPromise = (async () => {
                try {
                    setProcessingState(sampleId, configId, true);
                    updateProgressState(sampleId, configId, 0, 'Starting process...');

                    // TODO: Implement actual processing logic based on functionName
                    // This should integrate with your existing processing implementations

                    updateProgressState(sampleId, configId, 100, 'Processing complete');
                    setProcessingState(sampleId, configId, false);

                } catch (error: any) {
                    onError(error.message || 'Processing failed');
                    updateProgressState(sampleId, configId, 0, '');
                    setProcessingState(sampleId, configId, false);
                } finally {
                    delete processingPromisesRef.current[key];
                }
            })();
            processingPromisesRef.current[key] = processingPromise;
            return processingPromise;
        } else {
            return processingPromisesRef.current[key];
        }
    }, [setProcessingState, updateProgressState]);

    const fetchProcessedData = useCallback(async (sampleGroup: SampleGroup | null) => {
        if (!sampleGroup) return;

        try {
            // TODO: Implement actual data fetching logic
            // This should integrate with your existing data fetching implementations

            dispatch({
                type: 'SET_PROCESSED_DATA',
                data: {} // Replace with actual fetched data
            });
        } catch (error) {
            console.error('Error fetching processed data:', error);
        }
    }, []);

    const value: ProcessedDataContextType = {
        processedData: state.processedData,
        isProcessing: state.isProcessing,
        progressStates: state.progressStates,
        uploadDownloadProgressStates: state.uploadDownloadProgressStates,
        processData,
        fetchProcessedData,
        setProcessingState,
        updateProcessedData,
        updateProgressState,
        getProgressState,
        updateUploadDownloadProgressState,
        getUploadDownloadProgressState,
    };

    return (
        <ProcessedDataContext.Provider value={value}>
            {children}
        </ProcessedDataContext.Provider>
    );
};