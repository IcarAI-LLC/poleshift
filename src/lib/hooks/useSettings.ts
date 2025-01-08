// src/lib/hooks/useSettings.ts
import { useCallback, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { usePowerSync } from '@powersync/react';
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import { DrizzleSchema, user_settings } from '../powersync/DrizzleSchema';
import { UserSettings } from '../types';
// Import your auth hook to get the current user’s ID
import { useAuth } from '@/lib/hooks'; // or wherever your auth hook is

/**
 * A React hook providing reactive access to **the current user’s** `user_settings` row
 * plus basic CRUD operations.
 *
 * The table has a primary key of type `text` named `id`, which references the user’s ID.
 */
export const useSettings = () => {
    const { user } = useAuth();
    const userId = user?.id; // typically a string user ID

    // 1. Get the PowerSync database and wrap it with Drizzle
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });

    // 2. Memoize a query that selects exactly the row for the current user
    const userSettingsQuery = useMemo(() => {
        return drizzleDB
            .select()
            .from(user_settings)
            .where(eq(user_settings.id, userId || ''));
    }, [drizzleDB, userId]);

    // 3. Convert the Drizzle query to something the useQuery hook can consume
    const compiledUserSettingsQuery = toCompilableQuery(userSettingsQuery);

    // 4. Fetch the data reactively (skip if we have no user)
    const {
        data: userSettingsArray = [],
        isLoading: userSettingsLoading,
        error: userSettingsError,
    } = useQuery<UserSettings>(compiledUserSettingsQuery);
    // 5. Typically there is only one settings row per user, so pick the first
    const userSettings = userSettingsArray[0];

    // 6. Handle loading & error states
    const loading = userSettingsLoading;
    const error = userSettingsError || null;

    // 7. Utility to log errors
    const setError = useCallback((err: string | null) => {
        if (err) {
            console.error(err);
        }
    }, []);

    // 8. CRUD Operations

    /**
     * Add a new user_settings row for this user.
     * If you’re treating the `id` column as the user’s ID, you might
     * want to do an upsert or just handle errors if a row already exists.
     */
    const addUserSetting = useCallback(
        async (setting: UserSettings) => {
            if (!userId) {
                throw new Error('Cannot add settings: No current user ID');
            }
            try {
                setting.id = userId;
                await drizzleDB.insert(user_settings).values(setting).run();
            } catch (err: any) {
                setError(err.message || 'Failed to add user setting');
                throw err;
            }
        },
        [drizzleDB, userId, setError]
    );

    /**
     * Update the current user’s row with new fields.
     */
    const updateUserSetting = useCallback(
        async (updates: Partial<UserSettings>) => {
            if (!userId) {
                throw new Error('Cannot update settings: No current user ID');
            }
            try {
                await drizzleDB
                    .update(user_settings)
                    .set(updates)
                    .where(eq(user_settings.id, userId))
                    .run();
            } catch (err: any) {
                setError(err.message || 'Failed to update user setting');
                throw err;
            }
        },
        [drizzleDB, userId, setError]
    );

    /**
     * Delete the current user’s settings row.
     */
    const deleteUserSetting = useCallback(async () => {
        if (!userId) {
            throw new Error('Cannot delete settings: No current user ID');
        }
        try {
            await drizzleDB
                .delete(user_settings)
                .where(eq(user_settings.id, userId))
                .run();
        } catch (err: any) {
            setError(err.message || 'Failed to delete user setting');
            throw err;
        }
    }, [drizzleDB, userId, setError]);

    // 9. Return the current user’s settings + CRUD
    return {
        // Single row for the current user (or null if none exists yet)
        userSettings,
        loading,
        error,

        // CRUD actions
        addUserSetting,
        updateUserSetting,
        deleteUserSetting,
    };
};

export default useSettings;
