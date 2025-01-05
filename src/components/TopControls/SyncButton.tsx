// src/components/TopControls/SyncButton.tsx

import React, { useMemo } from 'react';
import { useSyncProgress } from '@/lib/hooks/useSyncProgress';
import { RefreshCw } from 'lucide-react';

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

interface SyncButtonProps {
    isSyncing: boolean;
}

const SyncButton: React.FC<SyncButtonProps> = ({ isSyncing }) => {
    const { syncedCount, totalCount, progressPercent } = useSyncProgress(isSyncing);

    const tooltipText = useMemo(() => {
        if (!isSyncing) return 'All changes saved';
        if (syncedCount === null || totalCount === null) return 'Syncing data...';
        return `Syncing data... ${syncedCount} operations synced out of ${totalCount}`;
    }, [isSyncing, syncedCount, totalCount]);

    return (
        <div className="flex flex-col items-center">
            <Tooltip>
                <TooltipTrigger asChild>
                    <RefreshCw
                        color={isSyncing ? '#f44336' : '#4caf50'}
                        className={isSyncing ? 'animate-spin direction-reverse' : ''}
                        viewBox="0 0 24 24"
                    />
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>

            {/* Show a small progress bar if isSyncing and we have a progress value */}
            {isSyncing && progressPercent !== null && (
                <div className="mt-2 w-[100px]">
                    {/*
            1) We use className to target the child div in <Progress>
            2) We apply our CSS variable, which you’ve defined as --color-primary
          */}
                    <Progress
                        value={progressPercent}
                        className="[&>div]:bg-[var(--color-primary)]"
                    />
                </div>
            )}
        </div>
    );
};

export default SyncButton;
