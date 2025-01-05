// src/lib/powersync/SupabaseConnector.ts

import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { useAuthStore } from '../stores/authStore';
import { AbstractPowerSyncDatabase, CrudEntry, UpdateType } from '@powersync/web';
import {jwtDecode, JwtPayload} from 'jwt-decode';
import {
    UserRole,
    leadPermissions,
    adminPermissions,
    researcherPermissions,
    viewerPermissions,
    PoleshiftPermissions
} from '../types';

interface SupabaseJwtPayload extends JwtPayload {
    user_role?: UserRole;
    user_org?: string;
}

function groupByTableAndOp(ops: CrudEntry[]): Record<string, CrudEntry[]> {
    return ops.reduce((acc, op) => {
        const key = `${op.table}-${op.op}`;
        acc[key] = acc[key] || [];
        acc[key].push(op);
        return acc;
    }, {} as Record<string, CrudEntry[]>);
}

/**
 * The actual implementation of our Supabase connector.
 */
export class SupabaseConnectorImpl {
    readonly client: SupabaseClient;
    private lastUserId: string | null;

    constructor() {
        this.client = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY!,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                },
            }
        );

        this.lastUserId = null;

        // Subscribe to all authentication state changes, including the "INITIAL_SESSION" event
        this.client.auth.onAuthStateChange((event, session) => {
            // This event is fired for SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, INITIAL_SESSION, etc.
            if (
                [
                    'SIGNED_IN',
                    'SIGNED_OUT',
                    'USER_UPDATED',
                    'USER_DELETED',
                    'INITIAL_SESSION',
                    'TOKEN_REFRESHED',
                ].includes(event)
            ) {
                console.debug('Auth state changed:', event, session);
                this.handleSessionChange(session);
            }
        });
    }

    /**
     * Handle session changes by decoding the JWT and updating our Auth store.
     */
    private handleSessionChange(session: Session | null) {
        if (session) {
            // Decode the access token to retrieve custom claims (role/org, etc.)
            const jwtDecoded: SupabaseJwtPayload = jwtDecode(session.access_token);
            const userRole: UserRole | null = jwtDecoded.user_role || null;
            const userOrg: string | null = jwtDecoded.user_org || null;

            const newUserId = session.user.id || null;
            if (this.lastUserId !== newUserId) {
                console.log('User state changed:', {
                    previousUserId: this.lastUserId,
                    newUserId: newUserId,
                    userRole: userRole,
                    userOrg: userOrg,
                });
                this.lastUserId = newUserId;

                const { setUser, setRole, setOrganizationId, setPermissions, setUserId } =
                    useAuthStore.getState();

                setUser(session.user);
                setUserId(session.user.id);
                setRole(userRole);
                setOrganizationId(userOrg);
                setPermissions(this.getPermissionsForRole(userRole));
            }
        } else {
            // If session is null, user is signed out or no session was persisted
            // You can optionally clear out your store here:
            // const { resetAuthState } = useAuthStore.getState();
            // resetAuthState();
        }
    }

    private getPermissionsForRole(role: UserRole | null): PoleshiftPermissions[] | null {
        if (role == null) return null;
        if (role === UserRole.Admin) return adminPermissions;
        if (role === UserRole.Lead) return leadPermissions;
        if (role === UserRole.Researcher) return researcherPermissions;
        if (role === UserRole.Viewer) return viewerPermissions;
        return null;
    }

    // Authentication Methods
    async login(email: string, password: string) {
        const { error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
    }

    async signUp(email: string, password: string) {
        const { error } = await this.client.auth.signUp({ email, password });
        if (error) throw error;
    }

    async logout() {
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
    }

    async resetPassword(email: string) {
        const { error } = await this.client.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }

    /**
     * Instead of relying on `getSession`, we rely on the `INITIAL_SESSION` event.
     * If you do need to do a direct fetch, you can still call `getSession()`,
     * but be aware it may return outdated tokens if they were not yet refreshed.
     */
    async fetchCredentials() {
        try {
            console.debug('Fetching Supabase credentials...');
            const { data } = await this.client.auth.getSession();
            if (!data.session) {
                console.debug('No active session found via getSession().');
                return null;
            }

            console.debug('Credentials fetched successfully.');
            return {
                endpoint: import.meta.env.VITE_POWERSYNC_URL,
                token: data.session.access_token ?? '',
                expiresAt: data.session.expires_at
                    ? new Date(data.session.expires_at * 1000)
                    : undefined,
                user: data.session.user,
            };
        } catch (error) {
            console.error('Failed to fetch credentials:', error);
            throw error;
        }
    }

    /**
     * Batches the CRUD operations by table & operation type to reduce the number of network calls.
     */
    async uploadData(database: AbstractPowerSyncDatabase, attempt = 1, maxAttempts = 3): Promise<void> {
        const transaction = await database.getNextCrudTransaction();

        // If there is no transaction, do nothing
        if (!transaction) {
            console.debug('No transactions to upload.');
            return;
        }

        let lastOp: CrudEntry | null = null;

        try {
            console.debug(`Uploading data (attempt ${attempt}/${maxAttempts}) with batching...`);

            // 1. Group the ops by table and operation type
            const groupedOps = groupByTableAndOp(transaction.crud);

            // 2. Loop through each group and perform a single bulk operation
            for (const key of Object.keys(groupedOps)) {
                const ops = groupedOps[key];
                if (ops.length === 0) continue;

                const [tableName, opType] = key.split('-') as [string, UpdateType];
                const table = this.client.from(tableName);

                switch (opType) {
                    case UpdateType.PUT: {
                        // For PUT -> Use upsert
                        const rowsToUpsert = ops.map((op) => {
                            lastOp = op;
                            return { ...op.opData, id: op.id };
                        });
                        const result = await table.upsert(rowsToUpsert);
                        if (result.error) throw result.error;
                        break;
                    }
                    case UpdateType.PATCH: {
                        // For PATCH -> Use update
                        for (const op of ops) {
                            lastOp = op;
                            const { error } = await table.update(op.opData).eq('id', op.id);
                            if (error) throw error;
                        }
                        break;
                    }
                    case UpdateType.DELETE: {
                        // For DELETE -> Use delete
                        const idsToDelete = ops.map((op) => {
                            lastOp = op;
                            return op.id;
                        });
                        const result = await table.delete().in('id', idsToDelete);
                        if (result.error) throw result.error;
                        break;
                    }
                    default:
                        throw new Error(`Unsupported operation type: ${opType}`);
                }
            }

            // 3. Complete the transaction on success
            await transaction.complete();
            console.debug('Data upload successful.');
        } catch (error: any) {
            console.error('Error uploading data in batch:', error, 'Last operation:', lastOp);

            // Retry logic: only retry up to `maxAttempts` times
            if (attempt < maxAttempts) {
                const delayMs = 1000 * attempt;
                console.debug(`Retrying after ${delayMs}ms... (attempt ${attempt + 1} of ${maxAttempts})`);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                return this.uploadData(database, attempt + 1, maxAttempts);
            } else {
                console.error(
                    `Max retry attempts (${maxAttempts}) reached. Not discarding transaction, but will not retry again.`
                );
                // IMPORTANT: We do NOT call transaction.complete() here
                // so that the transaction remains in the queue for another future attempt
            }
        }
    }
}

/**
 * Singleton wrapper for SupabaseConnectorImpl.
 */
export class SupabaseConnectorSingleton {
    private static instance: SupabaseConnectorImpl | null = null;

    // Private constructor to prevent direct instantiation
    private constructor() {}

    /**
     * Lazily creates and returns the single instance of SupabaseConnectorImpl
     */
    public static getInstance(): SupabaseConnectorImpl {
        if (!SupabaseConnectorSingleton.instance) {
            SupabaseConnectorSingleton.instance = new SupabaseConnectorImpl();
        }
        return SupabaseConnectorSingleton.instance;
    }
}

// Option B: Provide a named export for the singleton instance itself
export const supabaseConnector = SupabaseConnectorSingleton.getInstance();
