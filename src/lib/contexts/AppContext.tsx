// src/lib/contexts/AppContext.tsx

import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { AppState, AppAction } from '../types';
import { rootReducer } from './reducers';
import { storage } from '../storage';
import { syncManager } from '../storage/sync';
import { api } from '../api';
import {initialProcessedDataState} from "./reducers/processedDataReducer.ts";

interface AppContextValue {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}

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
        },
        contextMenu: {
            isVisible: false,
            x: 0,
            y: 0,
            itemId: null
        }
    },
    processedData: initialProcessedDataState
};

export const AppContext = createContext<AppContextValue>({
    state: initialState,
    dispatch: () => null
});

interface AppProviderProps {
    children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
    const [state, dispatch] = useReducer(rootReducer, initialState);

    // Initialize app state from storage
    useEffect(() => {
        const initializeState = async () => {
            try {
                // Load auth state from local storage
                const savedAuth = localStorage.getItem('auth');
                if (savedAuth) {
                    const { user, userProfile, organization } = JSON.parse(savedAuth);
                    dispatch({ type: 'SET_USER', payload: user });
                    dispatch({ type: 'SET_USER_PROFILE', payload: userProfile });
                    dispatch({ type: 'SET_ORGANIZATION', payload: organization });
                }

                // Load sample groups from IndexedDB
                const sampleGroups = await storage.getAllSampleGroups();
                sampleGroups.forEach(group => {
                    dispatch({ type: 'ADD_SAMPLE_GROUP', payload: group });
                });

                // Load file tree
                const treeItems = await storage.getAllTreeItems();
                dispatch({ type: 'UPDATE_FILE_TREE', payload: treeItems });

                // Load locations
                const locations = await api.data.getLocations();
                dispatch({ type: 'SET_LOCATIONS', payload: locations });

                // Set loading to false
                dispatch({ type: 'SET_AUTH_LOADING', payload: false });
            } catch (error) {
                console.error('Error initializing app state:', error);
                dispatch({ type: 'SET_AUTH_ERROR', payload: 'Failed to initialize app' });
            }
        };

        initializeState();
    }, []);

    // Handle online/offline sync
    useEffect(() => {
        const handleOnline = () => {
            const sync = async () => {
                if (state.auth.organization?.id) {
                    dispatch({ type: 'SET_SYNCING', payload: true });
                    try {
                        await syncManager.fullSync(state.auth.organization.id);
                        dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
                    } catch (error) {
                        console.error('Sync error:', error);
                        dispatch({ type: 'SET_DATA_ERROR', payload: 'Sync failed' });
                    } finally {
                        dispatch({ type: 'SET_SYNCING', payload: false });
                    }
                }
            };
            sync();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [state.auth.organization?.id]);

    // Save auth state to local storage when it changes
    useEffect(() => {
        const authState = {
            user: state.auth.user,
            userProfile: state.auth.userProfile,
            organization: state.auth.organization
        };
        localStorage.setItem('auth', JSON.stringify(authState));
    }, [state.auth.user, state.auth.userProfile, state.auth.organization]);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
}

export const useAppState = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppState must be used within an AppProvider');
    }
    return context;
};