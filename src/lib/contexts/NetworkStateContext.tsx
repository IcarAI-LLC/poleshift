//@ts-ignore
import React, { createContext, useReducer, useEffect, useContext } from 'react';
import {networkService} from "../services/EnhancedNetworkService.ts";

interface NetworkState {
    isOnline: boolean;
    lastChecked: number;
    connectionStrength: 'strong' | 'weak' | 'none';
    lastSuccessfulPing: number | null;
}

type NetworkAction =
    | { type: 'SET_ONLINE_STATUS'; payload: boolean }
    | { type: 'SET_LAST_CHECKED'; payload: number }
    | { type: 'SET_CONNECTION_STRENGTH'; payload: 'strong' | 'weak' | 'none' }
    | { type: 'SET_LAST_SUCCESSFUL_PING'; payload: number };

interface NetworkContextType {
    state: NetworkState;
    dispatch: React.Dispatch<NetworkAction>;
}

const initialState: NetworkState = {
    isOnline: navigator.onLine,
    lastChecked: Date.now(),
    connectionStrength: 'none',
    lastSuccessfulPing: null,
};

export const NetworkStateContext = createContext<NetworkContextType>({
    state: initialState,
    dispatch: () => null,
});

function networkReducer(state: NetworkState, action: NetworkAction): NetworkState {
    switch (action.type) {
        case 'SET_ONLINE_STATUS':
            return {
                ...state,
                isOnline: action.payload,
            };
        case 'SET_LAST_CHECKED':
            return {
                ...state,
                lastChecked: action.payload,
            };
        case 'SET_CONNECTION_STRENGTH':
            return {
                ...state,
                connectionStrength: action.payload,
            };
        case 'SET_LAST_SUCCESSFUL_PING':
            return {
                ...state,
                lastSuccessfulPing: action.payload,
            };
        default:
            return state;
    }
}

export const NetworkStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(networkReducer, initialState);
    networkService.initialize();

    return (
        <NetworkStateContext.Provider value={{ state, dispatch }}>
            {children}
        </NetworkStateContext.Provider>
    );
};

export const useNetworkState = () => {
    const context = useContext(NetworkStateContext);
    if (!context) {
        throw new Error('useNetworkState must be used within a NetworkStateProvider');
    }
    return context;
};