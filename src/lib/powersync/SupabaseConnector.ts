import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { useAuthStore } from '@/stores/authStore';
import { AbstractPowerSyncDatabase, CrudEntry, UpdateType } from '@powersync/web';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import {
    UserRole,
    leadPermissions,
    adminPermissions,
    researcherPermissions,
    viewerPermissions,
    PoleshiftPermissions
} from "@/types";
import {assignClosestHealthyServer} from "@/lib/powersync/assignServer.ts";

interface SupabaseJwtPayload extends JwtPayload {
    user_role?: UserRole;
    user_org?: string;
}

/**
 * Helper to chunk an array into subarrays of a specific size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
            if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'USER_DELETED', 'INITIAL_SESSION', 'TOKEN_REFRESHED'].includes(event)) {
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

    // In SupabaseConnector.ts
    async validateLicenseKey(licenseKey: string) {
        // This would call a backend function or table query
        // returning { valid: boolean; organizationName?: string; errorMessage?: string }
        const { data, error } = await this.client.functions.invoke("validateLicenseKey", {
            body: { licenseKey }
        })

        if (error) {
            // For example, if license is not found or an error occurred
            return {
                valid: false,
                errorMessage: error.message ?? "License validation failed",
            }
        }

        // data might look like: { valid: true, organizationName: "My Org" }
        return data
    }

    async fetchCredentials() {
        try {
            console.debug('Fetching Supabase credentials...');
            const { data } = await this.client.auth.getSession();

            if (!data.session) {
                console.debug('No session found.');
                return null;
            }
            console.debug('Session found:', data.session.user.id);
            const powersync_server = await assignClosestHealthyServer(data.session.user.id);
            console.debug('Credentials fetched successfully.');
            console.log(import.meta.env.VITE_SUPABASE_URL);
            return {
                endpoint: powersync_server,
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
     * Batches the CRUD operations by table & operation type to reduce the number of network calls,
     * and limits each batch to `maxBatchSize`.
     *
     * This version does NOT discard failed transactions. Instead, it retries them.
     * Only if it succeeds does it call transaction.complete().
     */
    async uploadData(
        database: AbstractPowerSyncDatabase,
        attempt = 1,
        maxAttempts = 10,
        maxBatchSize = 1024 // <-- Add your default max batch size here
    ): Promise<void> {
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

            // 2. Loop through each group and perform chunked bulk operations
            for (const key of Object.keys(groupedOps)) {
                const ops = groupedOps[key];
                if (ops.length === 0) continue;

                // Break down large ops array into sub-chunks of maxBatchSize
                const opChunks = chunkArray(ops, maxBatchSize);

                const [tableName, opType] = key.split('-') as [string, UpdateType];
                const table = this.client.from(tableName);

                // Process each sub-chunk
                for (const chunk of opChunks) {
                    switch (opType) {
                        case UpdateType.PUT: {
                            // For PUT -> Use upsert
                            const rowsToUpsert = chunk.map(op => {
                                lastOp = op;
                                return { ...op.opData, id: op.id };
                            });
                            const result = await table.upsert(rowsToUpsert);
                            if (result.error) throw result.error;
                            break;
                        }
                        case UpdateType.PATCH: {
                            // For PATCH -> Use update
                            // We'll keep doing them one by one, but in a chunk-limited loop
                            for (const op of chunk) {
                                lastOp = op;
                                const { error } = await table.update(op.opData).eq('id', op.id);
                                if (error) throw error;
                            }
                            break;
                        }
                        case UpdateType.DELETE: {
                            // For DELETE -> Use delete in
                            const idsToDelete = chunk.map(op => {
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
            }

            // 3. Complete the transaction on success
            await transaction.complete();
            console.debug('Data upload successful.');
        } catch (error) {
            console.error('Error uploading data in batch:', error, 'Last operation:', lastOp);

            // Retry logic: only retry up to `maxAttempts` times
            if (attempt < maxAttempts) {
                // Optional: Exponential backoff or just a delay
                const delayMs = 1000 * attempt;
                console.debug(`Retrying after ${delayMs}ms... (attempt ${attempt + 1} of ${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Recursively call uploadData with incremented attempt
                return this.uploadData(database, attempt + 1, maxAttempts, maxBatchSize);
            } else {
                console.error(`Max retry attempts (${maxAttempts}) reached. Not discarding transaction, but will not retry again.`);
                // IMPORTANT: We do NOT call transaction.complete() here
                // so that the transaction remains in the queue for another future attempt
            }
        }
    }
}

export const supabaseConnector = new SupabaseConnector();
