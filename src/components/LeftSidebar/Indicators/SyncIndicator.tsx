import { Progress } from "@/components/ui/progress";
import clsx from "clsx";
import { Loader2 } from "lucide-react"; // shadcn spinner icon

import { useNetworkStatus } from "@/hooks/useNetworkStatus.ts";
import { useSyncProgress } from "@/hooks/useSyncProgress.ts";

interface SyncProgressIndicatorProps {
    collapsed?: boolean;
}

/**
 * A SyncProgressIndicator that uses shadcn’s Progress component.
 *
 *  - Not syncing => Show:
 *      - If collapsed: only a green checkmark icon
 *      - If expanded: a green checkmark icon + "Synced" text (no progress bar)
 *  - Syncing => Show:
 *      - If collapsed: only a spinner icon
 *      - If expanded:
 *          * spinner + "Syncing..." text
 *          * determinate or indeterminate progress bar
 */
export function SyncProgressIndicator({ collapsed = false }: SyncProgressIndicatorProps) {
    const { isSyncing } = useNetworkStatus();
    const { progressPercent, totalCount, syncedCount } = useSyncProgress(isSyncing);

    // If not syncing => Show green check icon
    if (!isSyncing) {
        return (
            <div className="flex items-center p-2">
                {/* Small green checkmark */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                    <circle cx="12" cy="12" r="10" />
                </svg>
                {/* Show text only if not collapsed */}
                {!collapsed && (
                    <span className="ml-2 text-sm text-muted-foreground">Synced</span>
                )}
            </div>
        );
    }

    // If syncing => Show spinner
    const hasDeterminate =
        typeof progressPercent === "number" && !Number.isNaN(progressPercent);

    // If collapsed, show only the spinner icon
    if (collapsed) {
        return (
            <div className="flex items-center p-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
        );
    }

    // Expanded (not collapsed) => show spinner + text + bar
    return (
        <div className="flex flex-col items-start gap-1 p-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Syncing...</span>
            </div>

            {/* Determinate mode */}
            {hasDeterminate ? (
                <>
                    <Progress
                        value={progressPercent}
                        className="h-2 w-full transition-all duration-200"
                    />
                    <div className="text-xs text-muted-foreground">
                        {syncedCount} / {totalCount} items
                    </div>
                </>
            ) : (
                // Indeterminate mode
                <div className="relative h-2 w-full overflow-hidden rounded bg-primary/10">
                    <div
                        className={clsx(
                            "absolute left-0 top-0 h-full w-1/3 bg-primary",
                            "animate-[progress-indeterminate_1.5s_infinite_linear]"
                        )}
                    />
                </div>
            )}
        </div>
    );
}
