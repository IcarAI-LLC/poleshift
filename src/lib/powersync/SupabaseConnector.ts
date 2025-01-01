import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { useAuthStore } from '../stores/authStore';
import { AbstractPowerSyncDatabase, CrudEntry, UpdateType } from '@powersync/web';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import {
    UserRole,
    leadPermissions,
    adminPermissions,
    researcherPermissions,
    viewerPermissions,
    PoleshiftPermissions
} from "../types";

interface SupabaseJwtPayload extends JwtPayload {
    user_role?: UserRole;
    user_org?: string;
}

function groupByTableAndOp(ops: CrudEntry[]): Record<string, CrudEntry[]> {
    // Example of grouping by `${table}-${opType}`
    return ops.reduce((acc, op) => {
        const key = `${op.table}-${op.op}`;
        acc[key] = acc[key] || [];
        acc[key].push(op);
        return acc;
    }, {} as Record<string, CrudEntry[]>);
}

export class SupabaseConnector {
    readonly client: SupabaseClient;
    private FATAL_RESPONSE_CODES: any;
    private lastUserId: string | null;

    constructor() {
        this.client = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY!,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true
                }
            }
        );
        this.lastUserId = null;

        // Subscribe to authentication state changes
        this.client.auth.onAuthStateChange((event, session) => {
            if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'USER_DELETED', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event)) {
                console.debug(session);
                this.handleSessionChange(session);
            }
        });
        this.initSession();
    }

    private async initSession() {
        const { data, error } = await this.client.auth.getSession();
        if (error) {
            console.error("Error initializing session:", error);
            return;
        }
        this.handleSessionChange(data.session);
    }

    private handleSessionChange(session: Session | null) {
        if (session) {
            const jwtDecoded: SupabaseJwtPayload = jwtDecode(session.access_token);
            const userRole: UserRole | null = jwtDecoded.user_role || null;
            const userOrg: string | null = jwtDecoded.user_org || null;

            const newUserId = session.user.id || null;

            if (this.lastUserId !== newUserId) {
                console.log("User state changed:", {
                    previousUserId: this.lastUserId,
                    newUserId: newUserId,
                    userRole: userRole,
                    userOrg: userOrg,
                });
                this.lastUserId = newUserId;
                const { setUser, setRole, setOrganizationId, setPermissions, setUserId } = useAuthStore.getState();

                setUser(session.user);
                setUserId(session.user.id);
                setRole(userRole);
                setOrganizationId(userOrg);
                setPermissions(this.getPermissionsForRole(userRole));
            }
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

    async fetchCredentials() {
        try {
            console.debug('Fetching Supabase credentials...');
            const { data } = await this.client.auth.getSession();

            if (!data.session) {
                console.debug('No session found.');
                return null;
            }

            console.debug('Credentials fetched successfully.');
            console.log(import.meta.env.VITE_SUPABASE_URL);
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
    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        const transaction = await database.getNextCrudTransaction();

        if (!transaction) {
            console.debug('No transactions to upload.');
            return;
        }

        let lastOp: CrudEntry | null = null;

        try {
            console.debug('Uploading data with batching...');

            // 1. Group the ops by table and operation type
            const groupedOps = groupByTableAndOp(transaction.crud);

            // 2. Loop through each group and perform a single bulk operation
            for (const key of Object.keys(groupedOps)) {
                const ops = groupedOps[key];
                if (ops.length === 0) continue;

                // The key is e.g. "my_table-PUT" or "my_table-PATCH"
                const [tableName, opType] = key.split('-') as [string, UpdateType];
                const table = this.client.from(tableName);

                // Gather all rows for the batch
                switch (opType) {
                    case UpdateType.PUT: {
                        // For PUT -> Use upsert
                        const rowsToUpsert = ops.map(op => {
                            lastOp = op;
                            return { ...op.opData, id: op.id };
                        });
                        const result = await table.upsert(rowsToUpsert);
                        if (result.error) throw result.error;
                        break;
                    }
                    case UpdateType.PATCH: {
                        // For PATCH -> Use update
                        // If each op could have different data, you either:
                        // - do them one-by-one, OR
                        // - group them by matching opData fields to reduce calls.
                        //
                        // For demonstration, we'll do them one-by-one in a single loop:
                        for (const op of ops) {
                            lastOp = op;
                            const { error } = await table.update(op.opData).eq('id', op.id);
                            if (error) throw error;
                        }
                        break;
                    }
                    case UpdateType.DELETE: {
                        // For DELETE -> Use delete
                        // We can batch all IDs together by using .in('id', arrayOfIds)
                        const idsToDelete = ops.map(op => {
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
            if (
                typeof error.code === 'string' &&
                this.FATAL_RESPONSE_CODES?.some((regex: { test: (arg0: any) => any }) => regex.test(error.code))
            ) {
                console.error('Fatal error during upload - discarding transaction:', error);
                await transaction.complete();
            } else {
                throw error;
            }
        }
    }
}

export const supabaseConnector = new SupabaseConnector();
