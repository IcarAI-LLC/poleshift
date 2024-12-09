// src/components/TopControls/TopControls.tsx
import React from 'react';
import { Box } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

import SidebarToggle from './SidebarToggle';
import SyncButton from './SyncButton';
import AccountButton from './AccountButton';
import FilterButton from './FilterButton';
import UploadQueueButton from './UploadQueueButton';

interface TopControlsProps {
    isSyncing: boolean;
    onToggleSidebar: (event: React.MouseEvent<HTMLButtonElement>) => void;
    setShowAccountActions: (value: boolean) => void;
    onOpenFilters: () => void;
    filterButtonRef: React.RefObject<HTMLButtonElement>;
    queuedUploadsCount: number;
    onToggleUploadQueue: () => void;
}

const TopControls: React.FC<TopControlsProps> = ({
                                                     isSyncing,
                                                     onToggleSidebar,
                                                     setShowAccountActions,
                                                     onOpenFilters,
                                                     filterButtonRef,
                                                     queuedUploadsCount,
                                                     onToggleUploadQueue,
                                                 }) => {
    const styles: SxProps<Theme> = {
        position: 'fixed',
        top: 'var(--spacing-sm)',
        left: 'var(--spacing-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 1001,
    };

    return (
        <Box sx={styles}>
            <SidebarToggle onToggle={onToggleSidebar} />
            <SyncButton isSyncing={isSyncing} />
            <FilterButton onClick={onOpenFilters} buttonRef={filterButtonRef} />
            <UploadQueueButton queueCount={queuedUploadsCount} onClick={onToggleUploadQueue} />
            <AccountButton setShowAccountActions={setShowAccountActions} />
        </Box>
    );
};

export default TopControls;
