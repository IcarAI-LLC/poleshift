// lib/contexts/AppContext.tsx
import React, { createContext, useReducer, useEffect } from 'react';
import type { AppState, AppAction } from '../types';
// lib/contexts/AppContext.tsx
//@ts-ignore
import { storage } from '../storage/indexedDB';
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
// Initialize services in the correct order
const networkService = new NetworkService();
const operationQueue = new OperationQueue(storage);
//@ts-ignore
const syncService = new SyncService(supabase, storage);
const syncManager = new SyncManager(networkService, operationQueue, syncService);
//@ts-ignore
const authService = new AuthService(supabase, storage);
// @ts-ignore
const dataService = new DataService(syncService, operationQueue, networkService, storage);
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
        progressStates: {}
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

// Add missing type to AppContext.tsx
interface Services {
    auth: AuthService;
    data: DataService;
    sync: SyncService;
    processedData: ProcessedDataService;
    network: NetworkService;
    operationQueue: OperationQueue;
    syncManager: SyncManager;
}

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
        syncManager: syncManager
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

        // Data Actions
        case 'SET_FILE_TREE':
            return {
                ...state,
                data: { ...state.data, fileTree: action.payload }
            };
        case 'SET_SAMPLE_GROUPS':
            return {
                ...state,
                data: { ...state.data, sampleGroups: action.payload }
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
        case 'SET_SYNCING':
            return {
                ...state,
                data: { ...state.data, isSyncing: action.payload }
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
                ui: { ...state.ui, selectedLeftItem: action.payload }
            };
        case 'SET_ERROR_MESSAGE':
            return {
                ...state,
                ui: { ...state.ui, errorMessage: action.payload }
            };

        default:
            return state;
    }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            try {
                const session = await supabase.getSession();
                if (session) {
                    const userProfile = await storage.getUserProfile(session.user.id);
                    const organization = userProfile?.organization_id ?
                        await storage.getOrganization(userProfile.organization_id) : null;
                    //@ts-ignore
                    dispatch({ type: 'SET_USER', payload: session.user });
                    //@ts-ignore
                    dispatch({ type: 'SET_USER_PROFILE', payload: userProfile });
                    if (organization) {
                        dispatch({ type: 'SET_ORGANIZATION', payload: organization });
                    }
                }
            } catch (error) {
                console.error('Auth initialization failed:', error);
            } finally {
                dispatch({ type: 'SET_AUTH_LOADING', payload: false });
            }
        };

        initAuth();
    }, []);

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
                    syncManager: syncManager
                }
            }}
        >
            {children}
        </AppContext.Provider>
    );
}