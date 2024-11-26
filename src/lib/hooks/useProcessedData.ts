// lib/hooks/useProcessedData.ts
import { useState, useCallback, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { SampleGroupMetadata } from '../types';

interface ProcessState {
    [key: string]: {
        progress: number;
        status: string;
    };
}

interface UploadDownloadState {
    [key: string]: {
        progress: number;
        status: string;
    };
}

export function useProcessedData() {
    const { state, services } = useContext(AppContext);
    const [processStates, setProcessStates] = useState<ProcessState>({});
    const [uploadDownloadStates, setUploadDownloadStates] = useState<UploadDownloadState>({});
    const [isProcessing, setIsProcessing] = useState<{[key: string]: boolean}>({});

    const updateProcessState = useCallback((key: string, progress: number, status: string) => {
        setProcessStates(prev => ({
            ...prev,
            [key]: { progress, status }
        }));
    }, []);

    const updateUploadDownloadState = useCallback((key: string, progress: number, status: string) => {
        setUploadDownloadStates(prev => ({
            ...prev,
            [key]: { progress, status }
        }));
    }, []);

    const processData = useCallback(async (
        processFunctionName: string,
        sampleGroupMetadata: SampleGroupMetadata,
        modalInputs: Record<string, string>,
        files: File[],
        configItem: any,
        onDataProcessed: (data: any) => void,
        onError: (message: string) => void
    ) => {
        const sampleId = sampleGroupMetadata.human_readable_sample_id;
        const configId = configItem.id;
        const key = `${sampleId}:${configId}`;

        try {
            setIsProcessing(prev => ({ ...prev, [key]: true }));
            updateProcessState(key, 0, 'Starting processing...');

            // Process the data
            const processedData = await services.processedData.processData(
                processFunctionName,
                sampleGroupMetadata,
                modalInputs,
                files,
                (progress: number, status: string) => updateProcessState(key, progress, status),
                (progress: number, status: string) => updateUploadDownloadState(key, progress, status)
            );

            // Save the processed data
            await services.processedData.saveProcessedData(sampleId, configId, processedData);

            onDataProcessed(processedData);
            updateProcessState(key, 100, 'Processing complete');
        } catch (error: any) {
            onError(error.message || 'Failed to process data');
            updateProcessState(key, 0, 'Processing failed');
        } finally {
            setIsProcessing(prev => ({ ...prev, [key]: false }));
        }
    }, [services.processedData, updateProcessState, updateUploadDownloadState]);

    const fetchProcessedData = useCallback(async (sampleGroupMetadata: SampleGroupMetadata) => {
        try {
            // Fetch from local storage first
            const localData = await services.processedData.getAllProcessedData(
                sampleGroupMetadata.human_readable_sample_id
            );

            // If online, sync with remote
            if (services.network.isOnline()) {
                await services.processedData.syncProcessedData(sampleGroupMetadata.human_readable_sample_id);
            }

            return localData;
        } catch (error) {
            console.error('Failed to fetch processed data:', error);
            return null;
        }
    }, [services.processedData, services.network]);

    const getProgressState = useCallback((sampleId: string, configId: string) => {
        const key = `${sampleId}:${configId}`;
        return processStates[key] || { progress: 0, status: '' };
    }, [processStates]);

    const getUploadDownloadProgressState = useCallback((sampleId: string, configId: string) => {
        const key = `${sampleId}:${configId}`;
        return uploadDownloadStates[key] || { progress: 0, status: '' };
    }, [uploadDownloadStates]);

    return {
        processedData: state.processedData,
        isProcessing,
        processData,
        fetchProcessedData,
        getProgressState,
        getUploadDownloadProgressState
    };
}
