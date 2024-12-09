// src/components/TopControls/SyncButton.tsx
import React from 'react';
import { Tooltip } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

interface SyncButtonProps {
    isSyncing: boolean;
}

const SyncButton: React.FC<SyncButtonProps> = ({ isSyncing }) => {
    return (
        <Tooltip title={isSyncing ? 'Syncing data...' : 'All changes saved'}>
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