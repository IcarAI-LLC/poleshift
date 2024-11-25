// src/lib/contexts/reducers/dataReducer.ts

import { DataState, AppAction } from '../../types';

const initialDataState: DataState = {
    fileTree: [],
    sampleGroups: {},
    locations: [],
    processingJobs: {},
    isSyncing: false,
    lastSynced: null,
    error: null
};

export function dataReducer(state: DataState = initialDataState, action: AppAction): DataState {
    switch (action.type) {
        case 'UPDATE_FILE_TREE':
            return {
                ...state,
                fileTree: action.payload
            };

        case 'ADD_SAMPLE_GROUP':
            return {
                ...state,
                sampleGroups: {
                    ...state.sampleGroups,
                    [action.payload.id]: action.payload
                }
            };

        case 'UPDATE_SAMPLE_GROUP':
            return {
                ...state,
                sampleGroups: {
                    ...state.sampleGroups,
                    [action.payload.id]: {
                        ...state.sampleGroups[action.payload.id],
                        ...action.payload
                    }
                }
            };

        case 'DELETE_SAMPLE_GROUP': {
            const { [action.payload]: deleted, ...remainingSampleGroups } = state.sampleGroups;
            return {
                ...state,
                sampleGroups: remainingSampleGroups
            };
        }

        case 'SET_LOCATIONS':
            return <DataState>{
                ...state,
                locations: action.payload
            };

        case 'UPDATE_PROCESSING_JOB':
            return {
                ...state,
                processingJobs: {
                    ...state.processingJobs,
                    [action.payload.id]: action.payload
                }
            };

        case 'SET_SYNCING':
            return {
                ...state,
                isSyncing: action.payload
            };

        case 'SET_LAST_SYNCED':
            return {
                ...state,
                lastSynced: action.payload
            };

        case 'SET_DATA_ERROR':
            return {
                ...state,
                error: action.payload
            };

        default:
            return state;
    }
}