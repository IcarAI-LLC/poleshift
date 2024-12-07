import { SupabaseClient, createClient, Session } from '@supabase/supabase-js';
import { useAuthStore } from '../stores/authStore';
import { UpdateType } from '@powersync/web';

export class SupabaseConnector {
    readonly client: SupabaseClient;
    currentSession: Session | null;

    constructor() {
        this.client = createClient(
            import.meta.env.VITE_SUPABASE_URL!,
            import.meta.env.VITE_SUPABASE_ANON_KEY!,
            { auth: { persistSession: true } }
        );
        this.currentSession = null;

        // Subscribe to authentication state changes
        //@ts-ignore
        this.client.auth.onAuthStateChange((event, session) => {
            this.handleSessionChange(session);
        });

        // Initialize session
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
        console.log("Handling session change for session", session);
        const { setUser } = useAuthStore.getState();
        this.currentSession = session;

        if (session && session.user) {
            //@ts-ignore
            setUser(session.user);
        } else {
            setUser(null);
        }
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
            const { data, error } = await this.client.auth.getSession();

            if (error) {
                throw error;
            }

            if (!data.session) {
                console.debug('No session found.');
                return null;
            }

            console.debug('Credentials fetched successfully.');

            return {
                endpoint: import.meta.env.VITE_POWERSYNC_URL,
                token: data.session.access_token ?? '',
                expiresAt: data.session.expires_at
                    ? new Date(data.session.expires_at * 1000)
                    : undefined
            };
        } catch (error) {
            console.error('Failed to fetch credentials:', error);
            //@ts-ignore
            this.updateSession(null); // Clear session on failure
            throw error;
        }
    }
    //@ts-ignore
    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        const transaction = await database.getNextCrudTransaction();

        if (!transaction) {
            console.debug('No transactions to upload.');
            return;
        }
        //@ts-ignore
        let lastOp: CrudEntry | null = null;

        try {
            console.debug('Uploading data...');
            for (const op of transaction.crud) {
                lastOp = op;
                const table = this.client.from(op.table);

                // **Revised Block: Parse JSON strings into arrays/objects correctly**
                if (op.table === 'processed_data' && typeof op.opData === 'object') {
                    const fieldsToParse = ['raw_file_paths', 'processed_file_paths', 'metadata', 'data'];
                    fieldsToParse.forEach((field) => {
                        if (op.opData[field] && typeof op.opData[field] === 'string') {
                            try {
                                op.opData[field] = JSON.parse(op.opData[field]);
                            } catch (e) {
                                console.error(`Failed to parse ${field}:`, e);
                                // Handle parsing error if necessary
                            }
                        }
                    });
                }

                let result: any;
                switch (op.op) {
                    case UpdateType.PUT:
                        result = await table.upsert({ ...op.opData, id: op.id });
                        break;
                    case UpdateType.PATCH:
                        result = await table.update(op.opData).eq('id', op.id);
                        break;
                    case UpdateType.DELETE:
                        result = await table.delete().eq('id', op.id);
                        break;
                    default:
                        throw new Error(`Unsupported operation type: ${op.op}`);
                }

                if (result.error) {
                    throw result.error;
                }
            }

            await transaction.complete();
            console.debug('Data upload successful.');
        } catch (error: any) {
            console.error('Error uploading data:', error, 'Last operation:', lastOp);
            //@ts-ignore
            if (typeof error.code === 'string' && FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code))) {
                console.error('Fatal error during upload - discarding transaction:', error);
                await transaction.complete();
            } else {
                throw error;
            }
        }
    }
}

export const supabaseConnector = new SupabaseConnector();
