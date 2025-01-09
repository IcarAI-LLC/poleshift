import React, { useMemo } from "react";
import { useSyncProgress } from "@/lib/hooks/useSyncProgress";
import { RefreshCw } from "lucide-react";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface SyncButtonProps {
    isSyncing: boolean;
}

export const SyncButton: React.FC<SyncButtonProps> = ({ isSyncing }) => {
    const { syncedCount, totalCount, progressPercent } = useSyncProgress(isSyncing);

    const tooltipText = useMemo(() => {
        if (!isSyncing) return "All changes saved";
        if (syncedCount === null || totalCount === null) return "Syncing data...";
        return `Syncing data... ${syncedCount} operations synced out of ${totalCount}`;
    }, [isSyncing, syncedCount, totalCount]);

    return (
        <div className="flex flex-col items-center">
            {/* 1. The icon is now rendered by itself */}
            <div className="relative inline-block">
                <RefreshCw
                    color={isSyncing ? "#f44336" : "#4caf50"}
                    className={isSyncing ? "animate-spin direction-reverse w-4 h-4" : "w-4 h-4"}
                />

                {/* 2. Tooltip trigger is an absolutely positioned span over the icon */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        {/* This span covers the icon area, making it hoverable. */}
                        <span className="absolute inset-0 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltipText}</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* 3. Show a small progress bar if isSyncing and we have a progress value */}
            {isSyncing && progressPercent !== null && (
                <div className="mt-2 w-[100px]">
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
