// src/lib/process/index.ts

import { useProcessStore } from '../stores/processStore';
import { useProcessedData } from '../hooks/useProcessedData';

// Unified interface for processing operations
export interface ProcessOperation {
    sampleGroup: SampleGroupMetadata;
    configItem: DropboxConfigItem;
    inputs: Record<string, any>;
    filePaths: string[];
    orgId: string;
}

export async function handleProcessOperation({
                                                 sampleGroup,
                                                 configItem,
                                                 inputs,
                                                 filePaths,
                                                 orgId
                                             }: ProcessOperation) {
    // Get store methods for status updates
    const { updateProcessStatus, setError } = useProcessStore.getState();
    const key = `${sampleGroup.id}:${configItem.id}`;

    try {
        // Initialize processing state
        updateProcessStatus(key, {
            isProcessing: true,
            progress: 0,
            status: 'Starting process...'
        });

        // Process data with progress tracking
        const result = await processData.processData(
            configItem.processFunctionName,
            sampleGroup,
            inputs,
            filePaths,
            {
                onProgress: (progress, status) => {
                    updateProcessStatus(key, { progress, status });
                }
            }
        );

        // Update status on completion
        updateProcessStatus(key, {
            progress: 100,
            status: 'Processing complete',
            isProcessing: false
        });

        return result;
    } catch (error) {
        // Handle errors
        const errorMessage = error instanceof Error ? error.message : 'Processing failed';
        setError(errorMessage);
        updateProcessStatus(key, {
            status: `Error: ${errorMessage}`,
            isProcessing: false
        });
        throw error;
    }
}

// Export all process-related functionality
export {
    processData,
    useProcessStore,
    useProcessedData
};