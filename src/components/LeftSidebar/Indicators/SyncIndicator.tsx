import { Loader2 } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus.ts";

interface SyncProgressIndicatorProps {
    collapsed?: boolean;
}

/**
 * A simplified SyncProgressIndicator that only shows:
 *  - Not syncing => a green check icon (+ optional "Synced" text)
 *  - Syncing => a spinner (+ optional "Syncing..." text)
 */
export function SyncProgressIndicator({ collapsed = false }: SyncProgressIndicatorProps) {
    const { isSyncing } = useNetworkStatus();

    // Not syncing => show green check
    if (!isSyncing) {
        return (
            <div className="flex items-center p-2">
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
                {!collapsed && <span className="ml-2 text-sm">Synced</span>}
            </div>
        );
    }

    // Syncing => show spinner
    return (
        <div className="flex items-center p-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {!collapsed && <span className="ml-2 text-sm">Syncing...</span>}
        </div>
    );
}
