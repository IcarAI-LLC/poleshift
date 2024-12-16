// src/lib/services/userService.ts

import { db } from '../powersync/db';
import type { UserProfile, Organization } from '../types';

/**
 * Fetches the user profile for a given user ID.
 * @param userId - The UUID of the user.
 * @returns The user profile or null if not found.
 */
export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const result = await db.get(
        `
            SELECT * FROM user_profiles
            WHERE id = ?
            LIMIT 1
        `,
        [userId]
    );
    return result as UserProfile | null;
};

/**
 * Fetches the organization details for a given organization ID.
 * @param orgId - The UUID of the organization.
 * @returns The organization details or null if not found.
 */
export const fetchOrganization = async (orgId: string): Promise<Organization | null> => {
    const result = await db.get(
        `
            SELECT * FROM organizations
            WHERE id = ?
            LIMIT 1
        `,
        [orgId]
    );
    return result as Organization | null;
};
