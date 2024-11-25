import { ProcessedDataState, ProcessedDataAction } from '../../types/processed-data';

const getProgressKey = (sampleId: string, configId: string) => `${sampleId}:${configId}`;

export const initialProcessedDataState: ProcessedDataState = {
    processedData: {},
    isProcessing: {},
    progressStates: {},
    uploadDownloadProgressStates: {},
};

export function processedDataReducer(
    state: ProcessedDataState = initialProcessedDataState,
    action: ProcessedDataAction
): ProcessedDataState {
    switch (action.type) {
        case 'SET_PROCESSING_STATE': {
            const key = getProgressKey(action.sampleId, action.configId);
            return {
                ...state,
                isProcessing: {
                    ...state.isProcessing,
                    [key]: action.isProcessing,
                },
            };
        }
        case 'UPDATE_PROCESSED_DATA': {
            const key = getProgressKey(action.sampleId, action.configId);
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    [key]: action.data,
                },
            };
        }
        case 'UPDATE_PROGRESS_STATE': {
            const key = getProgressKey(action.sampleId, action.configId);
            return {
                ...state,
                progressStates: {
                    ...state.progressStates,
                    [key]: {
                        progress: action.progress,
                        status: action.status,
                    },
                },
            };
        }
        case 'UPDATE_UPLOAD_DOWNLOAD_PROGRESS_STATE': {
            const key = getProgressKey(action.sampleId, action.configId);
            return {
                ...state,
                uploadDownloadProgressStates: {
                    ...state.uploadDownloadProgressStates,
                    [key]: {
                        progress: action.progress,
                        status: action.status,
                    },
                },
            };
        }
        case 'SET_PROCESSED_DATA': {
            return {
                ...state,
                processedData: action.data,
            };
        }
        default:
            return state;
    }
}