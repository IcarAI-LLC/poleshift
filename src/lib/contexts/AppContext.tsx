//src/lib/contexts/AppContext.tsx
import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { storage } from '../services/storage';
import { processData } from '../services/processing';

// Services object that holds all our service instances
export const services = {
    storage,
    processData
};

// Initial state for our app
const initialState = {
    processedData: {
        data: {},
        isProcessing: {},
        progressStates: {},
        uploadDownloadProgressStates: {},
    },
    error: null
};

// Action types
type Action =
    | { type: 'SET_PROCESSED_DATA'; payload: { key: string; data: any } }
    | { type: 'SET_PROCESSING_STATUS'; payload: { key: string; status: boolean } }
    | { type: 'SET_PROCESSED_DATA_PROGRESS'; payload: { key: string; progress: number; status: string } }
    | { type: 'SET_UPLOAD_DOWNLOAD_PROGRESS'; payload: { key: string; progress: number; status: string } }
    | { type: 'SET_ERROR_MESSAGE'; payload: string | null };

// Reducer function to handle state updates
function reducer(state: typeof initialState, action: Action) {
    switch (action.type) {
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

        case 'SET_PROCESSED_DATA_PROGRESS':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    progressStates: {
                        ...state.processedData.progressStates,
                        [action.payload.key]: {
                            progress: action.payload.progress,
                            status: action.payload.status
                        }
                    }
                }
            };

        case 'SET_UPLOAD_DOWNLOAD_PROGRESS':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    uploadDownloadProgressStates: {
                        ...state.processedData.uploadDownloadProgressStates,
                        [action.payload.key]: {
                            progress: action.payload.progress,
                            status: action.payload.status
                        }
                    }
                }
            };

        case 'SET_ERROR_MESSAGE':
            return {
                ...state,
                error: action.payload
            };

        default:
            return state;
    }
}

// Create context
type AppContextType = {
    state: typeof initialState;
    dispatch: React.Dispatch<Action>;
    services: typeof services;
};

const AppContext = createContext<AppContextType>({
    state: initialState,
    dispatch: () => null,
    services
});

// Context provider component
interface AppProviderProps {
    children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
    const [state, dispatch] = useReducer(reducer, initialState);

    return (
        <AppContext.Provider value={{ state, dispatch, services }}>
            {children}
        </AppContext.Provider>
    );
}

// Custom hook for using the AppContext
export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}

export { AppContext };