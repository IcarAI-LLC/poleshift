import { ProcessedDataAction } from '../../types/processed-data';
import { AppAction } from '../../types';

export function isProcessedDataAction(action: AppAction): action is ProcessedDataAction {
    const processedDataActions = [
        'SET_PROCESSING_STATE',
        'UPDATE_PROCESSED_DATA',
        'UPDATE_PROGRESS_STATE',
        'UPDATE_UPLOAD_DOWNLOAD_PROGRESS_STATE',
        'SET_PROCESSED_DATA'
    ];

    return processedDataActions.includes(action.type);
}