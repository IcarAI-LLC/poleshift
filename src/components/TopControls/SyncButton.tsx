// src/components/TopControls/SyncButton.tsx
import React, { useMemo } from 'react';
import { Tooltip } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { useSyncProgress } from '@/lib/hooks/useSyncProgress';

interface SyncButtonProps {
    isSyncing: boolean;
}

const SyncButton: React.FC<SyncButtonProps> = ({ isSyncing }) => {
    // Get queued oplog count
    const queuedCount = useSyncProgress(isSyncing);
    console.log("Queued count:", queuedCount);
    // Build the tooltip text
    const tooltipText = useMemo(() => {
        if (!isSyncing) return 'All changes saved';
        if (queuedCount === null) return 'Syncing data...';
        return `Syncing data, total of ~${queuedCount} operations synced`;
    }, [isSyncing, queuedCount]);

    return (
        <Tooltip title={tooltipText}>
      <span>
        <SyncIcon
            className={isSyncing ? 'syncing' : ''}
            sx={{
                fontSize: 24,
                fill: isSyncing ? '#f44336' : '#4caf50',
            }}
        />
      </span>
        </Tooltip>
    );
};

export default SyncButton;
