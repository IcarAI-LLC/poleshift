import { create } from 'zustand';
import { db } from '../powersync/db';
import { setupPowerSync } from '../powersync/db';

interface ConnectionStats {
    lastSync: Date | null;
    syncAttempts: number;
    failedAttempts: number;
}

interface NetworkState {
    // Status
    isOnline: boolean;
    isSyncing: boolean;
    connectionStats: ConnectionStats;
    error: string | null;
    lastError: Date | null;

    // Connection Management
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectInterval: number;

    // Actions
    initialize: () => Promise<void>;
    checkConnection: () => Promise<void>;
    startSync: () => Promise<void>;
    stopSync: () => void;
    resetConnectionStats: () => void;
    setError: (error: string | null) => void;

    // Getters
    getLastSyncTime: () => Date | null;
    getSyncStatus: () => { isSyncing: boolean; lastSync: Date | null };
}

const INITIAL_RECONNECT_INTERVAL = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

export const useNetworkStore = create<NetworkState>((set, get) => ({
    // Initial State
    isOnline: navigator.onLine,
    isSyncing: false,
    connectionStats: {
        lastSync: null,
        syncAttempts: 0,
        failedAttempts: 0,
    },
    error: null,
    lastError: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectInterval: INITIAL_RECONNECT_INTERVAL,

    // Initialize network monitoring and sync
    initialize: async () => {
        try {
            // Set up online/offline listeners
            window.addEventListener('online', () => {
                set({ isOnline: true });
                get().startSync();
            });

            window.addEventListener('offline', () => {
                set({ isOnline: false });
                get().stopSync();
            });

            // Initial connection check
            await get().checkConnection();

            // Start sync if online
            if (get().isOnline) {
                await get().startSync();
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Network initialization failed',
                lastError: new Date()
            });
        }
    },

    // Check connection status
    checkConnection: async () => {
        try {
            const isConnected = navigator.onLine;

            if (isConnected) {
                // Test database connection
                await db.execute('SELECT 1');
                set({
                    isOnline: true,
                    error: null,
                    reconnectAttempts: 0,
                    reconnectInterval: INITIAL_RECONNECT_INTERVAL
                });
            } else {
                throw new Error('No network connection');
            }
        } catch (error) {
            const { reconnectAttempts, maxReconnectAttempts } = get();

            if (reconnectAttempts < maxReconnectAttempts) {
                // Schedule reconnection attempt
                setTimeout(() => {
                    set(state => ({
                        reconnectAttempts: state.reconnectAttempts + 1,
                        reconnectInterval: state.reconnectInterval * 2 // Exponential backoff
                    }));
                    get().checkConnection();
                }, get().reconnectInterval);
            }

            set({
                isOnline: false,
                error: error instanceof Error ? error.message : 'Connection check failed',
                lastError: new Date()
            });
        }
    },

    // Start synchronization
    startSync: async () => {
        try {
            const state = get();
            if (state.isSyncing || !state.isOnline) return;

            set(state => ({
                isSyncing: true,
                connectionStats: {
                    ...state.connectionStats,
                    syncAttempts: state.connectionStats.syncAttempts + 1
                }
            }));

            // PowerSync handles the actual sync process
            // Here we just update our local state tracking
            await setupPowerSync();

            set(state => ({
                isSyncing: false,
                connectionStats: {
                    ...state.connectionStats,
                    lastSync: new Date()
                },
                error: null
            }));
        } catch (error) {
            set(state => ({
                isSyncing: false,
                error: error instanceof Error ? error.message : 'Sync failed',
                lastError: new Date(),
                connectionStats: {
                    ...state.connectionStats,
                    failedAttempts: state.connectionStats.failedAttempts + 1
                }
            }));
        }
    },

    // Stop synchronization
    stopSync: () => {
        set({ isSyncing: false });
    },

    // Reset connection statistics
    resetConnectionStats: () => {
        set({
            connectionStats: {
                lastSync: null,
                syncAttempts: 0,
                failedAttempts: 0
            },
            reconnectAttempts: 0,
            reconnectInterval: INITIAL_RECONNECT_INTERVAL,
            error: null,
            lastError: null
        });
    },

    // Error handling
    setError: (error: string | null) => {
        set({
            error,
            lastError: error ? new Date() : get().lastError
        });
    },

    // Getters
    getLastSyncTime: () => get().connectionStats.lastSync,

    getSyncStatus: () => ({
        isSyncing: get().isSyncing,
        lastSync: get().connectionStats.lastSync
    })
}));

// Export singleton instance
export default useNetworkStore;