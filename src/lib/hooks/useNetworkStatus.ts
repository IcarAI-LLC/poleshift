import { useCallback, useEffect, useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { DateTime } from 'luxon';

export const useNetworkStatus = () => {
    const {
        isOnline,
        isSyncing,
        connectionStats,
        error,
        lastError,
        reconnectAttempts,
        initialize,
        checkConnection,
        startSync,
        stopSync,
        resetConnectionStats,
        setError,
        getLastSyncTime,
        getSyncStatus
    } = useNetworkStore();

    // Initialize network monitoring on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    // Enhanced sync handler
    const handleStartSync = useCallback(async () => {
        try {
            if (!isOnline) {
                await checkConnection();
            }
            await startSync();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Sync failed');
        }
    }, [isOnline, checkConnection, startSync, setError]);

    // Connection status utilities
    const getConnectionStatus = useCallback(() => {
        if (!isOnline) return 'offline';
        if (isSyncing) return 'syncing';
        if (error) return 'error';
        return 'connected';
    }, [isOnline, isSyncing, error]);

    const getLastSyncTimeFormatted = useCallback(() => {
        const lastSync = getLastSyncTime();
        if (!lastSync) return 'Never';

        return DateTime.fromJSDate(lastSync).toRelative();
    }, [getLastSyncTime]);

    // Computed values
    const syncStats = useMemo(() => ({
        successRate: connectionStats.syncAttempts > 0
            ? ((connectionStats.syncAttempts - connectionStats.failedAttempts) /
                connectionStats.syncAttempts * 100).toFixed(1)
            : '100',
        totalAttempts: connectionStats.syncAttempts,
        failedAttempts: connectionStats.failedAttempts,
        lastSyncFormatted: getLastSyncTimeFormatted()
    }), [connectionStats, getLastSyncTimeFormatted]);

    const connectionQuality = useMemo(() => {
        if (!isOnline) return 'disconnected';
        if (reconnectAttempts > 0) return 'unstable';
        if (error) return 'error';
        return 'good';
    }, [isOnline, reconnectAttempts, error]);

    // Auto-retry logic
    useEffect(() => {
        let retryTimeout: NodeJS.Timeout;

        if (error && isOnline) {
            retryTimeout = setTimeout(() => {
                handleStartSync();
            }, 30000); // Retry every 30 seconds if there's an error
        }

        return () => {
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [error, isOnline, handleStartSync]);

    return {
        // Basic state
        isOnline,
        isSyncing,
        error,
        lastError,

        // Enhanced sync controls
        startSync: handleStartSync,
        stopSync,
        resetConnectionStats,

        // Status getters
        connectionStatus: getConnectionStatus(),
        connectionQuality,
        lastSyncTime: getLastSyncTime(),
        lastSyncFormatted: getLastSyncTimeFormatted(),
        syncStats,

        // Current sync status
        currentSyncStatus: getSyncStatus(),

        // Actions
        checkConnection,
        setError,

        // Computed properties
        hasError: Boolean(error),
        isConnecting: reconnectAttempts > 0,
        canSync: isOnline && !isSyncing,
        needsSync: isOnline && !!error,

        // Stats
        totalReconnectAttempts: reconnectAttempts,
        syncSuccessRate: syncStats.successRate
    };
};

export default useNetworkStatus;