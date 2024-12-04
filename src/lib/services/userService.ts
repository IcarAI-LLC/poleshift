// src/lib/services/userService.ts

import { db } from '../powersync/db';
import type { UserProfile, Organization } from '../types';

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
