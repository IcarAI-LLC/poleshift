import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { PendingOperation } from '../types';

interface NetworkState {
    isOnline: boolean;
    connectionStrength: 'strong' | 'weak' | 'none';
    lastChecked: number;
    lastSuccessfulSync: number | null;
    pendingOperations: PendingOperation[];
}

interface NetworkActions {
    setOnlineStatus: (status: boolean) => void;
    setConnectionStrength: (strength: 'strong' | 'weak' | 'none') => void;
    updateLastChecked: () => void;
    setLastSuccessfulSync: (timestamp: number) => void;
    addPendingOperation: (operation: PendingOperation) => void;
    removePendingOperation: (operationId: string) => void;
    clearPendingOperations: () => void;
    waitForConnection: (timeout?: number) => Promise<boolean>;
}

const initialState: NetworkState = {
    isOnline: navigator.onLine,
    connectionStrength: 'none',
    lastChecked: Date.now(),
    lastSuccessfulSync: null,
    pendingOperations: [],
};

export const useNetworkStore = create<NetworkState & NetworkActions>()(
    devtools(
        (set, get) => ({
            ...initialState,

            setOnlineStatus: (status) => {
                set({
                    isOnline: status,
                    lastChecked: Date.now(),
                });
            },

            setConnectionStrength: (strength) => {
                set({ connectionStrength: strength });
            },

            updateLastChecked: () => {
                set({ lastChecked: Date.now() });
            },

            setLastSuccessfulSync: (timestamp) => {
                set({ lastSuccessfulSync: timestamp });
            },

            addPendingOperation: (operation) => {
                set((state) => ({
                    pendingOperations: [...state.pendingOperations, operation],
                }));
            },

            removePendingOperation: (operationId) => {
                set((state) => ({
                    pendingOperations: state.pendingOperations.filter(
                        (op) => op.id !== operationId
                    ),
                }));
            },

            clearPendingOperations: () => {
                set({ pendingOperations: [] });
            },

            waitForConnection: async (timeout = 30000): Promise<boolean> => {
                const startTime = Date.now();

                while (Date.now() - startTime < timeout) {
                    if (get().isOnline) {
                        return true;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                return false;
            },
        }),
        {
            name: 'network-store',
        }
    )
);

// Initialize network listeners
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        useNetworkStore.getState().setOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
        useNetworkStore.getState().setOnlineStatus(false);
    });
}