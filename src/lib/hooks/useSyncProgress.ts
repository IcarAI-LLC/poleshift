// src/lib/hooks/useSyncProgress.ts
import { useEffect, useState } from 'react';
import { usePowerSync } from '@powersync/react';

export function useSyncProgress(isSyncing: boolean) {
    const db = usePowerSync();
    const [queuedCount, setQueuedCount] = useState<number | null>(null);

    useEffect(() => {
        let isCancelled = false;
        let intervalId: NodeJS.Timeout | null = null;

        const fetchOplogCount = async () => {
            try {
                const result = await db.get<{ totalOps: number }>(
                    'SELECT COUNT(*) AS totalOps FROM ps_oplog'
                );
                if (!isCancelled) {
                    setQueuedCount(result?.totalOps ?? 0);
                }
            } catch (error) {
                console.error('Failed to count ps_oplog rows:', error);
                if (!isCancelled) {
                    setQueuedCount(null);
                }
            }
        };

        if (isSyncing) {
            // Run once immediately
            fetchOplogCount();
            // Then poll every 2 seconds (adjust as needed)
            intervalId = setInterval(fetchOplogCount, 10000);
        } else {
            setQueuedCount(null);
        }

        return () => {
            isCancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [isSyncing, db]);

    return queuedCount;
}
