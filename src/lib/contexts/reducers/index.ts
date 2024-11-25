import { AppState, AppAction } from '../../types';
import { authReducer } from './authReducer';
import { dataReducer } from './dataReducer';
import { uiReducer } from './uiReducer';
import { processedDataReducer, initialProcessedDataState } from './processedDataReducer';
import { isProcessedDataAction } from './typeGuards';

const initialState: AppState = {
    auth: {
        user: null,
        userProfile: null,
        organization: null,
        loading: true,
        error: null
    },
    data: {
        fileTree: [],
        sampleGroups: {},
        locations: [],
        processingJobs: {},
        isSyncing: false,
        lastSynced: null,
        error: null
    },
    ui: {
        selectedLeftItem: null,
        selectedRightItem: null,
        isSidebarCollapsed: false,
        isRightSidebarCollapsed: true,
        showAccountActions: false,
        errorMessage: '',
        filters: {
            startDate: null,
            endDate: null,
            selectedLocations: []
        },
        modal: {
            isOpen: false,
            title: '',
            type: 'input',
            configItem: undefined,
            modalInputs: {},
            data: undefined
        }
    },
    processedData: initialProcessedDataState
};

export function rootReducer(state: AppState = initialState, action: AppAction): AppState {
    return {
        auth: authReducer(state.auth, action),
        data: dataReducer(state.data, action),
        ui: uiReducer(state.ui, action),
        processedData: isProcessedDataAction(action)
            ? processedDataReducer(state.processedData, action)
            : state.processedData
    };
}