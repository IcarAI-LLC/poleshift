import { AuthState, Organization, User, UserProfile } from "./auth";
import {DataState, LocationAction, ProcessingJob, SampleGroup, TreeItem} from "./data";
import { UIState } from "./ui";
import {ProcessedDataAction, ProcessedDataState} from "./processed-data";

export * from './data';
export * from './errors';
export * from './auth';
export * from './ui';
export * from './processed-data';

// Define action types by domain
export type AuthAction =
    | { type: 'SET_USER'; payload: User | null }
    | { type: 'SET_USER_PROFILE'; payload: UserProfile | null }
    | { type: 'SET_ORGANIZATION'; payload: Organization | null }
    | { type: 'SET_AUTH_LOADING'; payload: boolean }
    | { type: 'SET_AUTH_ERROR'; payload: string | null };

export type DataAction =
    | { type: 'UPDATE_FILE_TREE'; payload: TreeItem[] }
    | { type: 'ADD_SAMPLE_GROUP'; payload: SampleGroup }
    | { type: 'UPDATE_SAMPLE_GROUP'; payload: SampleGroup }
    | { type: 'DELETE_SAMPLE_GROUP'; payload: string }
    | { type: 'SET_LOCATIONS'; payload: Location[] }
    | { type: 'UPDATE_PROCESSING_JOB'; payload: ProcessingJob }
    | { type: 'SET_SYNCING'; payload: boolean }
    | { type: 'SET_LAST_SYNCED'; payload: number }
    | { type: 'SET_DATA_ERROR'; payload: string | null };

export type UIAction =
    | { type: 'SET_SELECTED_LEFT_ITEM'; payload: TreeItem | null }
    | { type: 'SET_SELECTED_RIGHT_ITEM'; payload: Location | null }
    | { type: 'TOGGLE_SIDEBAR'; payload?: boolean }
    | { type: 'TOGGLE_RIGHT_SIDEBAR'; payload?: boolean }
    | { type: 'SET_SHOW_ACCOUNT_ACTIONS'; payload: boolean }
    | { type: 'SET_ERROR_MESSAGE'; payload: string }
    | { type: 'SET_FILTERS'; payload: UIState['filters'] }
    | { type: 'SET_MODAL_STATE'; payload: UIState['modal'] };

export interface AppState {
    auth: AuthState;
    data: DataState;
    ui: UIState;
    processedData: ProcessedDataState;
}

// Combine all action types
export type AppAction = AuthAction | DataAction | UIAction | ProcessedDataAction | LocationAction;