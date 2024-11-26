import { createClient, SupabaseClient } from '@supabase/supabase-js';
//@ts-ignore
import { User, UserProfile, Organization } from '../types';

const SUPABASE_URL = 'https://poleshift.icarai.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWt3a25ueGN1dWhpd3VuZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg0NTQ0MDMsImV4cCI6MjA0NDAzMDQwM30._qVQAlYoL5jtSVCAKIznQ_5pI73Ke08YzZnoy_50Npg';

class SupabaseService {
    private client: SupabaseClient;
    private static instance: SupabaseService;

    private constructor() {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    public static getInstance(): SupabaseService {
        if (!SupabaseService.instance) {
            SupabaseService.instance = new SupabaseService();
        }
        return SupabaseService.instance;
    }

    // Auth methods
    async signIn(email: string, password: string) {
        const { data, error } = await this.client.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    }

    async signOut() {
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
    }

    async getSession() {
        const { data: { session }, error } = await this.client.auth.getSession();
        if (error) throw error;
        return session;
    }

    // Profile methods
    async getUserProfile(userId: string): Promise<UserProfile> {
        const { data, error } = await this.client
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('User profile not found');
        return data;
    }

    async getOrganization(orgId: string): Promise<Organization> {
        const { data, error } = await this.client
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Organization not found');
        return data;
    }

    // Data sync methods
    async syncTable<T>(tableName: string, orgId: string, since?: number): Promise<T[]> {
        let query = this.client
            .from(tableName)
            .select('*')
            .eq('org_id', orgId);

        if (since) {
            query = query.gt('updated_at', new Date(since).toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async insertRecord<T>(tableName: string, record: Partial<T>): Promise<T> {
        const { data, error } = await this.client
            .from(tableName)
            .insert(record)
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new Error('Failed to insert record');
        return data;
    }

    async updateRecord<T>(tableName: string, id: string, updates: Partial<T>): Promise<T> {
        const { data, error } = await this.client
            .from(tableName)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new Error('Failed to update record');
        return data;
    }

    async deleteRecord(tableName: string, id: string): Promise<void> {
        const { error } = await this.client
            .from(tableName)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    // Storage methods
    async uploadFile(bucket: string, path: string, file: File): Promise<string> {
        const { data, error } = await this.client.storage
            .from(bucket)
            .upload(path, file, { upsert: true });

        if (error) throw error;
        return data.path;
    }

    async downloadFile(bucket: string, path: string): Promise<Blob> {
        const { data, error } = await this.client.storage
            .from(bucket)
            .download(path);

        if (error) throw error;
        return data;
    }
}

export const supabase = SupabaseService.getInstance();