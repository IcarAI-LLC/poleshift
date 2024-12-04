//src/lib/powersync/SupabaseConnector.ts

import {
    AbstractPowerSyncDatabase,
    BaseObserver,
    CrudEntry,
    PowerSyncBackendConnector,
    UpdateType
} from '@powersync/web';

import { Session, SupabaseClient, createClient } from '@supabase/supabase-js';

export type SupabaseConfig = {
    supabaseUrl: string;
    supabaseAnonKey: string;
    powersyncUrl: string;
};

/// Postgres Response codes that we cannot recover from by retrying.
const FATAL_RESPONSE_CODES = [
    new RegExp('^22...$'), // Class 22 — Data Exception
    new RegExp('^23...$'), // Class 23 — Integrity Constraint Violation
    new RegExp('^42501$')  // INSUFFICIENT PRIVILEGE
];

export type SupabaseConnectorListener = {
    initialized?: () => void;
    sessionStarted?: (session: Session) => void;
    sessionEnded?: () => void;
};

export class SupabaseConnector
    extends BaseObserver<SupabaseConnectorListener>
    implements PowerSyncBackendConnector {
    readonly client: SupabaseClient;
    readonly config: SupabaseConfig;

    ready: boolean;
    currentSession: Session | null;

    constructor() {
        super();
        this.config = {
            supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
            powersyncUrl: import.meta.env.VITE_POWERSYNC_URL,
            supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
        };

        this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
            auth: {
                persistSession: true
            }
        });

        this.currentSession = null;
        this.ready = false;
    }

    async init() {
        if (this.ready) {
            console.debug('SupabaseConnector is already initialized.');
            return;
        }

        try {
            console.debug('Initializing SupabaseConnector...');
            const sessionResponse = await this.client.auth.getSession();
            this.updateSession(sessionResponse.data.session);

            // Add this auth state change listener
            this.client.auth.onAuthStateChange((event, session) => {
                this.updateSession(session);
            });

            this.ready = true;
            this.iterateListeners((cb) => cb.initialized?.());
            console.debug('SupabaseConnector initialized successfully.');
        } catch (error) {
            console.error('Failed to initialize SupabaseConnector:', error);
            throw error;
        }
    }

    async login(email: string, password: string) {
        try {
            console.debug('Logging in...');
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Login error:', error);
                throw error;
            }

            this.updateSession(data.session);
            console.debug('Login successful:', data.session);
        } catch (error) {
            console.error('Failed to log in:', error);
            throw error;
        }
    }

    async logout() {
        try {
            console.debug('Logging out...');
            const { error } = await this.client.auth.signOut();

            if (error) {
                console.error('Logout error:', error);
                throw error;
            }

            this.updateSession(null);
            console.debug('Logout successful.');
        } catch (error) {
            console.error('Failed to log out:', error);
            throw error;
        }
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
                endpoint: this.config.powersyncUrl,
                token: data.session.access_token ?? '',
                expiresAt: data.session.expires_at
                    ? new Date(data.session.expires_at * 1000)
                    : undefined
            };
        } catch (error) {
            console.error('Failed to fetch credentials:', error);
            this.updateSession(null); // Clear session on failure
            throw error;
        }
    }

    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        const transaction = await database.getNextCrudTransaction();

        if (!transaction) {
            console.debug('No transactions to upload.');
            return;
        }

        let lastOp: CrudEntry | null = null;

        try {
            console.debug('Uploading data...');
            for (const op of transaction.crud) {
                lastOp = op;
                const table = this.client.from(op.table);

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

            if (typeof error.code === 'string' && FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code))) {
                console.error('Fatal error during upload - discarding transaction:', error);
                await transaction.complete();
            } else {
                throw error;
            }
        }
    }

    updateSession(session: Session | null) {
        this.currentSession = session;

        if (session) {
            console.debug('Session started:', session);
            this.iterateListeners((cb) => cb.sessionStarted?.(session));
        } else {
            console.debug('Session ended.');
            this.iterateListeners((cb) => cb.sessionEnded?.());
        }
    }
}
