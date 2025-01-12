import { useEffect, useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { supabaseConnector } from "@/lib/powersync/SupabaseConnector.ts";
import {useAuth} from "@/hooks/useAuth.ts";

interface SyncProgress {
    syncedCount: number | null;      // number of items already synced (ps_oplog grows)
    totalCount: number | null;       // total items we plan to sync
    progressPercent: number | null;  // e.g. 0..100
}

export function useSyncProgress(isSyncing: boolean): SyncProgress {
    const db = usePowerSync();
    const { user } = useAuth();
    const userId = user?.id;
    // Keep track of how many items have synced and how many total are needed
    const [syncedCount, setSyncedCount] = useState<number | null>(null);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [progressPercent, setProgressPercent] = useState<number | null>(null);

    useEffect(() => {
        let isCancelled = false;
        let intervalId: NodeJS.Timeout | null = null;

        /**
         * 1. Fetch total_count from your `get_sync_count` Edge Function.
         *    If total_count changes over time, you can refetch periodically.
         */
        async function fetchTotalCount() {
            try {
                if (!userId) return;
                const { data, error } = await supabaseConnector.client.functions.invoke(
                    'get_sync_count'
                );
                if (error) {
                    console.error('Error calling get_sync_count:', error);
                    if (!isCancelled) setTotalCount(null);
                    return;
                }
                // Expect data to look like: { total_count: number }
                if (!isCancelled && data) {
                    setTotalCount(data.total_count ?? 0);
                }
            } catch (err) {
                console.error('Failed to fetch total_count:', err);
                if (!isCancelled) setTotalCount(null);
            }
        }

        /**
         * 2. Count how many have synced so far, i.e. how many records in ps_oplog.
         *    ps_oplog grows as data is synced, so this number will increase.
         */
        async function fetchSyncedCount() {
            try {
                const result = await db.get<{ totalOps: number }>(
                     'SELECT COUNT(*) AS totalOps FROM ps_oplog'
                );
                if (!isCancelled) {
                    // setSyncedCount(result?.totalOps ?? 0);
                    setSyncedCount(result?.totalOps ?? 0);
                }
            } catch (error) {
                console.error('Failed to count ps_oplog rows:', error);
                if (!isCancelled) {
                    setSyncedCount(null);
                }
            }
        }

        // Fetch total_count once at mount (or periodically if you want it updated)
        fetchTotalCount();

        if (isSyncing) {
            fetchTotalCount();
            // Poll every 10s (tweak as needed)
            intervalId = setInterval(fetchSyncedCount, 30000);
        } else {
            // If not syncing, reset
            setSyncedCount(null);
        }

        return () => {
            isCancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [isSyncing, db]);

    /**
     * 3. Calculate a progress % = (syncedCount / totalCount) * 100
     */
    useEffect(() => {
        if (syncedCount == null || totalCount == null) {
            setProgressPercent(null);
            return;
        }

        // If ps_oplog is how many items have *already* been synced:
        const raw = (syncedCount / totalCount) * 100;
        // clamp between 0..100
        const clamped = Math.min(100, Math.max(0, raw));
        setProgressPercent(clamped);
    }, [syncedCount, totalCount]);

    return { syncedCount, totalCount, progressPercent };
}
