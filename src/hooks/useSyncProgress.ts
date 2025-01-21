import { useEffect, useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { supabaseConnector } from "@/lib/powersync/SupabaseConnector.ts";
import { useAuth } from "@/hooks/useAuth.ts";

interface SyncProgress {
    syncedCount: number | null;      // number of items already synced (ps_oplog grows)
    totalCount: number | null;       // total items we plan to sync
    progressPercent: number | null;  // e.g. 0..100
}

export function useSyncProgress(isSyncing: boolean): SyncProgress {
    const db = usePowerSync();
    const { user } = useAuth();
    const userId = user?.id;

    const [syncedCount, setSyncedCount] = useState<number | null>(null);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [progressPercent, setProgressPercent] = useState<number | null>(null);

    /**
     * Single effect that both watches ps_oplog *and* calls the Edge Function on each watch iteration.
     */
    useEffect(() => {
        // If we're not syncing, reset everything.
        if (!isSyncing) {
            setSyncedCount(null);
            setTotalCount(null);
            return;
        }

        let isCancelled = false;

        (async () => {
            try {
                // Watch ps_oplog for new or changed rows.
                for await (const result of db.watch(
                    `
          SELECT COUNT(*) AS totalOps
          FROM ps_oplog
        `,
                    []
                )) {
                    if (isCancelled) {
                        break; // stop if component unmounted
                    }

                    // Extract the synced ops count
                    const row = result.rows?._array?.[0];
                    if (row && typeof row.totalOps === 'number') {
                        setSyncedCount(row.totalOps);
                    }

                    // Optionally fetch the total count from your Edge Function each time
                    if (userId) {
                        try {
                            const { data, error } = await supabaseConnector.client.functions.invoke(
                                'get_sync_count'
                            );
                            if (error) {
                                console.error('Error calling get_sync_count:', error);
                                if (!isCancelled) setTotalCount(null);
                                continue;
                            }
                            if (!isCancelled && data) {
                                setTotalCount(data.total_count ?? 0);
                            }
                        } catch (err) {
                            console.error('Failed to fetch total_count:', err);
                            if (!isCancelled) setTotalCount(null);
                        }
                    }
                }
            } catch (error) {
                console.error('Error watching ps_oplog:', error);
                if (!isCancelled) {
                    setSyncedCount(null);
                    setTotalCount(null);
                }
            }
        })();

        // Cleanup
        return () => {
            isCancelled = true;
        };
    }, [isSyncing, userId, db]);

    /**
     * Calculate a progress % = (syncedCount / totalCount) * 100
     */
    useEffect(() => {
        if (syncedCount == null || totalCount == null) {
            setProgressPercent(null);
            return;
        }
        const raw = (syncedCount / totalCount) * 100;
        const clamped = Math.min(100, Math.max(0, raw));
        setProgressPercent(clamped);
    }, [syncedCount, totalCount]);

    return { syncedCount, totalCount, progressPercent };
}
