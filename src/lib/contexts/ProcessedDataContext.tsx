// lib/contexts/ProcessedDataContext.tsx
import React, { createContext, useReducer } from 'react';

interface ProcessedDataState {
    data: {
        [key: string]: any;
    };
    isProcessing: {
        [key: string]: boolean;
    };
    error: string | null;
}

type ProcessedDataAction =
    | { type: 'SET_PROCESSED_DATA'; payload: { key: string; data: any } }
    | { type: 'SET_PROCESSING'; payload: { key: string; isProcessing: boolean } }
    | { type: 'SET_ERROR'; payload: string | null };

const initialState: ProcessedDataState = {
    data: {},
    isProcessing: {},
    error: null
};

export const ProcessedDataContext = createContext<{
    state: ProcessedDataState;
    dispatch: React.Dispatch<ProcessedDataAction>;
}>({
    state: initialState,
    dispatch: () => null
});

function processedDataReducer(state: ProcessedDataState, action: ProcessedDataAction): ProcessedDataState {
    switch (action.type) {
        case 'SET_PROCESSED_DATA':
            return {
                ...state,
                data: {
                    ...state.data,
                    [action.payload.key]: action.payload.data
                }
            };
        case 'SET_PROCESSING':
            return {
                ...state,
                isProcessing: {
                    ...state.isProcessing,
                    [action.payload.key]: action.payload.isProcessing
                }
            };
        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload
            };
        default:
            return state;
    }
}

export function ProcessedDataProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(processedDataReducer, initialState);

    return (
        <ProcessedDataContext.Provider value={{ state, dispatch }}>
            {children}
        </ProcessedDataContext.Provider>
    );
}