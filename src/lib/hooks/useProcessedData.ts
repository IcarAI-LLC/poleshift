// src/lib/hooks/useProcessedData.ts

import { useCallback, useEffect } from 'react';
import { useProcessStore } from '../stores/processStore';
import type { SampleGroupMetadata } from '../types';
import type { DropboxConfigItem } from '../../config/dropboxConfig';

export const useProcessedData = () => {
    const {
        processedData,
        error,
        processStatuses,
        processData,
        fetchProcessedData,
        getProgressState,
        getUploadDownloadProgressState,
        updateProcessStatus,
        resetProcessStatus,
        setError,
    } = useProcessStore();

    // Reset error on unmount
    useEffect(() => {
        return () => {
            setError(null);
        };
    }, [setError]);

    // Enhanced process data handler
// Add uploadedRawPaths as a parameter in the function signature
    const handleProcessData = useCallback(
        async (
            processFunctionName: string,
            sampleGroup: SampleGroupMetadata,
            inputs: Record<string, any>,
            filePaths: string[],
            configItem: DropboxConfigItem,
            onSuccess: (result: any, configItem: DropboxConfigItem, processedData: any) => void,
            onError: (message: string) => void,
            orgId: string,
            uploadedRawPaths?: string[] // Add this line
        ) => {
            try {
                await processData(
                    processFunctionName,
                    sampleGroup,
                    inputs,
                    filePaths,
                    configItem,
                    onSuccess,
                    onError,
                    orgId,
                    //@ts-ignore
                    uploadedRawPaths // Pass it here
                );
                console.log("Data processed successfully");
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Processing failed');
                throw error;
            }
        },
        [processData, setError]
    );


    // Enhanced fetch processed data handler
    const handleFetchProcessedData = useCallback(
        async (sampleGroup: SampleGroupMetadata) => {
            try {
                return await fetchProcessedData(sampleGroup);
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Failed to fetch processed data');
                throw error;
            }
        },
        [fetchProcessedData, setError]
    );

    // Utility functions
    const isProcessing = useCallback(
        (sampleId: string, configId: string): boolean => {
            const key = `${sampleId}:${configId}`;
            return processStatuses[key]?.isProcessing || false;
        },
        [processStatuses]
    );

    const getProgress = useCallback(
        (sampleId: string, configId: string): number => {
            const key = `${sampleId}:${configId}`;
            return processStatuses[key]?.progress || 0;
        },
        [processStatuses]
    );

    const getStatus = useCallback(
        (sampleId: string, configId: string): string => {
            const key = `${sampleId}:${configId}`;
            return processStatuses[key]?.status || '';
        },
        [processStatuses]
    );

    const hasProcessedData = useCallback(
        (sampleId: string, configId: string): boolean => {
            const key = `${sampleId}:${configId}`;
            return Boolean(processedData[key]);
        },
        [processedData]
    );

    const getProcessedData = useCallback(
        (sampleId: string, configId: string): any => {
            const key = `${sampleId}:${configId}`;
            return processedData[key];
        },
        [processedData]
    );

    // Progress tracking utilities
    const trackProgress = useCallback(
        (sampleId: string, configId: string, progress: number, status: string) => {
            const key = `${sampleId}:${configId}`;
            updateProcessStatus(key, { progress, status });
        },
        [updateProcessStatus]
    );

    const resetProgress = useCallback(
        (sampleId: string, configId: string) => {
            const key = `${sampleId}:${configId}`;
            resetProcessStatus(key);
        },
        [resetProcessStatus]
    );

    return {
        // State
        processedData,
        error,

        // Enhanced actions
        processData: handleProcessData,
        fetchProcessedData: handleFetchProcessedData,

        // Status utilities
        isProcessing,
        getProgress,
        getStatus,
        hasProcessedData,
        getProcessedData,

        // Progress tracking
        trackProgress,
        resetProgress,
        getProgressState,
        getUploadDownloadProgressState,

        // Error handling
        setError,

        // Computed properties
        totalProcessedItems: Object.keys(processedData).length,
        hasActiveProcesses: Object.values(processStatuses).some((status) => status.isProcessing),
    };
};

export default useProcessedData;
