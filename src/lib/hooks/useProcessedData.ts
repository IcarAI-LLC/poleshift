import { useCallback } from 'react';
import { useProcessedDataStore } from '../stores';
import type { SampleGroupMetadata } from '../types';
import type { DropboxConfigItem } from '../../config/dropboxConfig';

export function useProcessedData() {
    const {
        data: processedData,
        isProcessing,
        error,
        processData,
        getProgressState,
        getUploadDownloadProgressState,
        fetchProcessedData,
        deleteProcessedDataForSample
    } = useProcessedDataStore();

    const handleProcessData = useCallback(async (
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        modalInputs: Record<string, string>,
        filePaths: string[],
        configItem: DropboxConfigItem,
        onDataProcessed: (data: any) => void,
        onError: (message: string) => void,
        orgId: string
    ) => {
        return processData(
            processFunctionName,
            sampleGroup,
            modalInputs,
            filePaths,
            configItem,
            onDataProcessed,
            onError,
            orgId
        );
    }, [processData]);

    return {
        processedData,
        isProcessing,
        error,
        processData: handleProcessData,
        getProgressState,
        getUploadDownloadProgressState,
        fetchProcessedData,
        deleteProcessedDataForSample
    };
}