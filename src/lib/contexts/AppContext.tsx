// lib/contexts/AppContext.tsx
//@ts-ignore
import React, { createContext, useReducer, useEffect } from 'react';
import type { AppState, AppAction, Services } from '../types';
//@ts-ignore
import { IndexedDBStorage, storage } from '../storage/indexedDB';
import { supabase } from '../supabase/client';
import {
    NetworkService,
    OperationQueue,
    SyncManager
} from '../services/offline';
import {
    AuthService,
    DataService,
    SyncService,
    ProcessedDataService
} from '../services';
import { IndexedDBProcessedDataStorage, processedDataStorage } from "../storage/processedDataDB";

// Initialize services in the correct order
const networkService = new NetworkService();
const operationQueue = new OperationQueue(storage);
const syncService = new SyncService(supabase, storage);
const syncManager = new SyncManager(networkService, operationQueue, syncService);
const authService = new AuthService(supabase, storage);
const dataService = new DataService(syncService, networkService, operationQueue, storage);
const processedDataService = new ProcessedDataService(
    syncService,
    networkService,
    operationQueue,
    storage
);

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
        isSyncing: false,
        lastSynced: null,
        error: null
    },
    processedData: {
        data: {},
        isProcessing: {},
        error: null,
        processedData: {},
        progressStates: {},
        uploadDownloadProgressStates: {}
    },
    ui: {
        selectedLeftItem: null,
        selectedRightItem: null,
        isSidebarCollapsed: false,
        isRightSidebarCollapsed: false,
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
            modalInputs: undefined,
            data: undefined
        },
        contextMenu: {
            isVisible: false,
            x: 0,
            y: 0,
            itemId: null
        }
    }
};

export const AppContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    services: Services;
}>({
    state: initialState,
    dispatch: () => null,
    services: {
        auth: authService,
        data: dataService,
        sync: syncService,
        processedData: processedDataService,
        network: networkService,
        operationQueue: operationQueue,
        syncManager: syncManager,
        processedDataStorage: processedDataStorage
    }
});

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        // Auth Actions
        case 'SET_USER':
            return {
                ...state,
                auth: { ...state.auth, user: action.payload }
            };
        case 'SET_USER_PROFILE':
            return {
                ...state,
                auth: { ...state.auth, userProfile: action.payload }
            };
        case 'SET_ORGANIZATION':
            return {
                ...state,
                auth: { ...state.auth, organization: action.payload }
            };
        case 'SET_AUTH_LOADING':
            return {
                ...state,
                auth: { ...state.auth, loading: action.payload }
            };
        case 'SET_AUTH_ERROR':
            return {
                ...state,
                auth: { ...state.auth, error: action.payload }
            };
        case 'CLEAR_AUTH':
            return {
                ...state,
                auth: {
                    user: null,
                    userProfile: null,
                    organization: null,
                    loading: false,
                    error: null
                }
            };

        // Data Actions
        case 'SET_FILE_TREE':
            return {
                ...state,
                data: { ...state.data, fileTree: action.payload }
            };
        case 'SET_SAMPLE_GROUPS':
            return {
                ...state,
                data: {
                    ...state.data,
                    sampleGroups: action.payload,
                },
            };
        case 'ADD_SAMPLE_GROUP':
            return {
                ...state,
                data: {
                    ...state.data,
                    sampleGroups: {
                        ...state.data.sampleGroups,
                        [action.payload.id]: action.payload
                    }
                }
            };
        case 'UPDATE_SAMPLE_GROUP':
            const updatedGroup = action.payload;
            return {
                ...state,
                data: {
                    ...state.data,
                    sampleGroups: {
                        ...state.data.sampleGroups,
                        [updatedGroup.id]: updatedGroup,
                    },
                },
            };
        case 'SET_SYNCING':
            return {
                ...state,
                data: { ...state.data, isSyncing: action.payload }
            };
        case 'SET_LAST_SYNCED':
            return {
                ...state,
                data: { ...state.data, lastSynced: action.payload }
            };
        case 'SET_DATA_ERROR':
            return {
                ...state,
                data: { ...state.data, error: action.payload }
            };
        case 'SET_LOCATIONS':
            return {
                ...state,
                data: {
                    ...state.data,
                    locations: action.payload
                }
            };

        // ProcessedData Actions
        case 'SET_PROCESSED_DATA':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    data: {
                        ...state.processedData.data,
                        [action.payload.key]: action.payload.data
                    }
                }
            };
        case 'SET_PROCESSING_STATUS':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    isProcessing: {
                        ...state.processedData.isProcessing,
                        [action.payload.key]: action.payload.status
                    }
                }
            };

        // UI Actions
        case 'SET_SELECTED_LEFT_ITEM':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    selectedLeftItem: action.payload
                }
            };

        case 'SET_SELECTED_RIGHT_ITEM':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    selectedRightItem: action.payload
                }
            };

        case 'TOGGLE_SIDEBAR':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isSidebarCollapsed: action.payload !== undefined
                        ? action.payload
                        : !state.ui.isSidebarCollapsed
                }
            };

        case 'TOGGLE_RIGHT_SIDEBAR':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isRightSidebarCollapsed: action.payload !== undefined
                        ? action.payload
                        : !state.ui.isRightSidebarCollapsed
                }
            };

        case 'SET_SHOW_ACCOUNT_ACTIONS':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    showAccountActions: action.payload
                }
            };

        case 'SET_ERROR_MESSAGE':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    errorMessage: action.payload
                }
            };

        case 'SET_FILTERS':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    filters: action.payload
                }
            };

        case 'SET_MODAL_STATE':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    modal: action.payload
                }
            };

        case 'SET_CONTEXT_MENU_STATE':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    contextMenu: action.payload
                }
            };
        default:
            return state;
    }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    return (
        <AppContext.Provider
            value={{
                state,
                dispatch,
                services: {
                    auth: authService,
                    data: dataService,
                    sync: syncService,
                    processedData: processedDataService,
                    network: networkService,
                    operationQueue: operationQueue,
                    syncManager: syncManager,
                    processedDataStorage: IndexedDBProcessedDataStorage.getInstance()
                }
            }}
        >
            {children}
        </AppContext.Provider>
    );
}