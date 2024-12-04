// src/lib/powersync/SupabaseConnector.ts

import { SupabaseClient, createClient, Session } from '@supabase/supabase-js';
import { useAuthStore } from '../stores/authStore';

export class SupabaseConnector {
    readonly client: SupabaseClient;
    currentSession: Session | null;

    constructor() {
        this.client = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
            { auth: { persistSession: true } }
        );
        this.currentSession = this.client.auth.getSession() || null;

        // Subscribe to authentication state changes
        this.client.auth.onAuthStateChange((event, session) => {
            this.handleSessionChange(session);
        });

        // Initialize session
        this.initSession();
    }

    private async initSession() {
        const { data } = await this.client.auth.getSession();
        this.handleSessionChange(data.session);
    }

    private handleSessionChange(session: Session | null) {
        console.log("Handling session change for session", session);
        const { setUser } = useAuthStore.getState();
        this.currentSession = session;

        if (session && session.user) {
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
}

export const supabaseConnector = new SupabaseConnector();
