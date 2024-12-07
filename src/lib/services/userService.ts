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

/**
 * Creates a new user profile with the role 'lead'.
 * @param userId - The UUID of the user.
 * @param organizationId - The UUID of the organization.
 * @returns A promise that resolves if the insertion is successful.
 */
export const createUserProfile = async (userId: string, organizationId: string): Promise<void> => {
    try {
        await db.execute(
            `
            INSERT INTO user_profiles (id, organization_id, user_tier)
            VALUES (?, ?, 'lead')
            `,
            [userId, organizationId]
        );
        console.log(`User profile created for user ID: ${userId}`);
    } catch (error) {
        console.error('Error creating user profile:', error);
        throw new Error('Failed to create user profile.');
    }
};
