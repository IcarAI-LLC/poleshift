// src/lib/hooks/useNetworkStatus.ts

import { useStatus } from '@powersync/react';
import { DateTime } from 'luxon';
import { useMemo } from 'react';

export const useNetworkStatus = () => {
    const status = useStatus();

    // Derive states from the PowerSync status
    const isOnline = status.connected || status.dataFlowStatus?.uploading || status.dataFlowStatus?.downloading;
    const isSyncing = Boolean(status.dataFlowStatus?.uploading || status.dataFlowStatus?.downloading);
    const lastSyncTime = status.lastSyncedAt;

    const lastSyncFormatted = useMemo(() => {
        if (!lastSyncTime) return 'Never';
        return DateTime.fromJSDate(lastSyncTime).toRelative();
    }, [lastSyncTime]);

    // Connection status interpretation
    const connectionStatus = useMemo(() => {
        if (!isOnline) return 'offline';
        if (isSyncing) return 'syncing';
        return 'connected';
    }, [isOnline, isSyncing]);

    // Since we no longer have an error field, return null or handle if needed
    const error = null;

    return {
        // Basic states
        isOnline,
        isSyncing,
        error,

        // Derived statuses
        connectionStatus,
        lastSyncTime,
        lastSyncFormatted,

        // Additional info
        hasSynced: status.hasSynced,
        needsSync: isOnline && !status.hasSynced,
    };
};

export default useNetworkStatus;
