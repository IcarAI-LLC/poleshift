// src/lib/hooks/useSettings.ts

import { useCallback, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { usePowerSync } from '@powersync/react';
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import { DrizzleSchema, user_settings } from '../powersync/DrizzleSchema';
import { eq } from 'drizzle-orm';
import {UserSettings} from "../types";

/**
 * Helper: Convert an array of objects (with `id` property) into a Record keyed by `id`.
 */
function arrayToRecord<T extends { id: number }>(arr: T[]): Record<number, T> {
    const record: Record<number, T> = {};
    for (const item of arr) {
        record[item.id] = item;
    }
    return record;
}

/**
 * A React hook providing reactive access to user_settings rows and basic CRUD operations.
 */
export const useSettings = () => {
    // 1. Get the PowerSync database and wrap it with Drizzle
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });

    // 2. Define your query to select from user_settings (all rows by default)
    const userSettingsQuery = drizzleDB.select().from(user_settings);

    // 3. Convert the Drizzle query to something useQuery can consume
    const compiledUserSettingsQuery = toCompilableQuery(userSettingsQuery);

    // 4. Use the useQuery hook to fetch user_settings data reactively
    const {
        data: userSettingsArray = [],
        isLoading: userSettingsLoading,
        error: userSettingsError,
    } = useQuery<UserSettings>(compiledUserSettingsQuery);

    // 5. Convert the array into a record keyed by the id
    const userSettings = useMemo(() => arrayToRecord(userSettingsArray), [userSettingsArray]);

    // 6. Handle loading & error states
    const loading = userSettingsLoading;
    const error = userSettingsError || null;

    // 7. Utility for setting error in callbacks
    const setError = useCallback((err: string | null) => {
        if (err) {
            console.error(err);
        }
    }, []);

    // 8. CRUD Operations

    /**
     * Add a new user_settings row.
     *
     * @param setting Partial row data (excluding `id`, which is auto-incremented if you’re using SQLite real primaryKey)
     */
    const addUserSetting = useCallback(
        async (setting: UserSettings) => {
            try {
                await drizzleDB.insert(user_settings).values(setting).run();
            } catch (err: any) {
                setError(err.message || 'Failed to add user setting');
                throw err;
            }
        },
        [drizzleDB, setError]
    );

    /**
     * Update an existing user_settings row by its `id`.
     *
     * @param id The `id` of the row to update
     * @param updates The fields to update
     */
    const updateUserSetting = useCallback(
        async (id: number, updates: Partial<UserSettings>) => {
            try {
                await drizzleDB
                    .update(user_settings)
                    .set(updates)
                    .where(eq(user_settings.id, id))
                    .run();
            } catch (err: any) {
                setError(err.message || 'Failed to update user setting');
                throw err;
            }
        },
        [drizzleDB, setError]
    );

    /**
     * Delete an existing user_settings row by its `id`.
     */
    const deleteUserSetting = useCallback(
        async (id: number) => {
            try {
                await drizzleDB.delete(user_settings).where(eq(user_settings.id, id)).run();
            } catch (err: any) {
                setError(err.message || 'Failed to delete user setting');
                throw err;
            }
        },
        [drizzleDB, setError]
    );

    // 9. Return all data and operations
    return {
        // Reactive data
        userSettingsArray, // as an array
        userSettings,      // as a record keyed by `id`
        loading,
        error,

        // CRUD actions
        addUserSetting,
        updateUserSetting,
        deleteUserSetting,
    };
};

export default useSettings;
