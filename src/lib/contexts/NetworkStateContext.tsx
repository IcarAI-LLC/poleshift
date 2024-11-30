//@ts-ignore
import React, { createContext, useReducer, useEffect, useContext } from 'react';
import {networkService} from "../services/EnhancedNetworkService.ts";

/**
 * Represents the state of a network connection, including its online status,
 * the last check timestamp, the current strength of the connection,
 * and the last successful ping time.
 *
 * @interface NetworkState
 *
 * @property {boolean} isOnline - Indicates whether the network is currently online.
 *
 * @property {number} lastChecked - The timestamp when the network status was last checked.
 *
 * @property {'strong' | 'weak' | 'none'} connectionStrength - Represents the current strength of the connection.
 * It can be 'strong', 'weak', or 'none'.
 *
 * @property {number | null} lastSuccessfulPing - The timestamp of the last successful ping to the server.
 * It is null if a successful ping has not been made yet.
 */
interface NetworkState {
    isOnline: boolean;
    lastChecked: number;
    connectionStrength: 'strong' | 'weak' | 'none';
    lastSuccessfulPing: number | null;
}

/**
 * Represents an action related to network status management, which can be one of several defined types.
 *
 * The `NetworkAction` type describes various actions that can be performed to update the application's network state. Actions are represented as objects where each has a `type` and an associated `payload`.
 *
 * Types of `NetworkAction` include:
 * - SET_ONLINE_STATUS: Indicates whether the network is online. The payload is a boolean.
 * - SET_LAST_CHECKED: Records the last time the network status was checked. The payload is a timestamp in milliseconds.
 * - SET_CONNECTION_STRENGTH: Sets the current strength of the network connection. The payload can be 'strong', 'weak', or 'none'.
 * - SET_LAST_SUCCESSFUL_PING: Records the last time a successful network ping occurred. The payload is a timestamp in milliseconds.
 */
type NetworkAction =
    | { type: 'SET_ONLINE_STATUS'; payload: boolean }
    | { type: 'SET_LAST_CHECKED'; payload: number }
    | { type: 'SET_CONNECTION_STRENGTH'; payload: 'strong' | 'weak' | 'none' }
    | { type: 'SET_LAST_SUCCESSFUL_PING'; payload: number };

/**
 * Interface representing the context type for network operations.
 *
 * This interface provides a structure for managing network state and dispatching network actions
 * within a React component tree. It is primarily used with the React Context API to maintain
 * and update global network-related states across different components.
 *
 * @property {NetworkState} state - The current state of the network, encapsulated within a `NetworkState` type.
 * @property {React.Dispatch<NetworkAction>} dispatch - A dispatch function that allows for sending network actions.
 * It uses the `NetworkAction` type to determine available actions that can affect the network state.
 */
interface NetworkContextType {
    state: NetworkState;
    dispatch: React.Dispatch<NetworkAction>;
}

/**
 * Represents the initial state of the network.
 *
 * @typedef {Object} NetworkState
 * @property {boolean} isOnline - Indicates if the application is currently online, derived from the browser's navigator object.
 * @property {number} lastChecked - A timestamp indicating the last time the network status was evaluated.
 * @property {string} connectionStrength - Describes the strength of the network connection, with default value 'none'.
 * @property {?number} lastSuccessfulPing - A timestamp of the last successful network ping, or null if no successful pings have occurred.
 *
 * @type {NetworkState}
 */
const initialState: NetworkState = {
    isOnline: navigator.onLine,
    lastChecked: Date.now(),
    connectionStrength: 'none',
    lastSuccessfulPing: null,
};

/**
 * NetworkStateContext is a React context that holds the network state and
 * a dispatch function to update this state. The context provides a way to pass
 * the network state and dispatch method through the component tree without
 * having to manually pass props down at every level.
 *
 * This context is initialized with a default value consisting of:
 * - state: The initial state of the network, which should be an object reflecting the network's current status.
 * - dispatch: A placeholder function that is intended to be replaced with a dispatch function by a Context.Provider, enabling updates to the state.
 *
 * Typically, this context will be used in conjunction with a context provider that wraps an application's component
 * tree, supplying the components within the tree access to the network state and the ability to dispatch state updates.
 *
 * @type {React.Context<NetworkContextType>}
 */
export const NetworkStateContext = createContext<NetworkContextType>({
    state: initialState,
    dispatch: () => null,
});

/**
 * Reduces the state of the network based on the dispatched action.
 *
 * @param {NetworkState} state - The current state of the network.
 * @param {NetworkAction} action - The action being dispatched which determines how the network state should change.
 * @return {NetworkState} The new state of the network after applying the action.
 */
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

/**
 * NetworkStateProvider is a React functional component that provides network state management
 * using the Context API and the useReducer hook. It initializes the network service and
 * supplies state and dispatch functions through context to its children components.
 *
 * @component
 * @param {Object} props - The properties passed to this component.
 * @param {React.ReactNode} props.children - The child components that will have access to the network state.
 * @returns {JSX.Element} A context provider that encapsulates child components and provides network state management.
 */
export const NetworkStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(networkReducer, initialState);
    networkService.initialize();

    return (
        <NetworkStateContext.Provider value={{ state, dispatch }}>
            {children}
        </NetworkStateContext.Provider>
    );
};

/**
 * Custom hook to access the current state of the network from the NetworkStateContext.
 *
 * @throws Will throw an error if the hook is used outside of a NetworkStateProvider.
 * @returns The current network state from the context.
 */
export const useNetworkState = () => {
    const context = useContext(NetworkStateContext);
    if (!context) {
        throw new Error('useNetworkState must be used within a NetworkStateProvider');
    }
    return context;
};