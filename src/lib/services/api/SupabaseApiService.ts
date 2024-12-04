import { SupabaseClient } from '@supabase/supabase-js';
import type {
    User,
    UserProfile,
    Organization,
    SampleGroupMetadata,
    FileNode,
    SampleLocation,
    ProcessedDataEntry
} from '../../types';
import type { ApiService } from './ApiService';
import { StorageService } from '../storage/StorageService';

export class SupabaseApiService implements ApiService {
    constructor(
        private supabase: SupabaseClient,
        private storage: StorageService
    ) {}

    async signIn(email: string, password: string): Promise<{ user: User; session: any }> {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        if (!data.user || !data.session) {
            throw new Error('No user or session returned from sign in');
        }

        const user: User = {
            id: data.user.id,
            email: data.user.email || '',
            last_sign_in_at: data.user.last_sign_in_at || null
        };

        return { user, session: data.session };
    }

    async signUp(email: string, password: string, licenseKey: string): Promise<void> {
        const { data: licenseData, error: licenseError } = await this.supabase
            .from('license_keys')
            .select('*')
            .eq('key', licenseKey)
            .single();

        if (licenseError || !licenseData || !licenseData.is_active) {
            throw new Error('Invalid or inactive license key');
        }

        const { error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: { license_key: licenseKey }
            }
        });

        if (error) throw error;
    }

    async signOut(): Promise<void> {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    async resetPassword(email: string): Promise<void> {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }

    async getSession(): Promise<any> {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        if (error) throw error;
        return session;
    }

    async getCurrentUser(): Promise<User | null> {
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error) throw error;
        if (!user) return null;

        return {
            id: user.id,
            email: user.email || '',
            last_sign_in_at: user.last_sign_in_at || null
        };
    }

    async getUserProfile(userId: string): Promise<UserProfile> {
        const { data, error } = await this.supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('User profile not found');

        return data;
    }

    async getOrganization(orgId: string): Promise<Organization> {
        const { data, error } = await this.supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Organization not found');

        return data;
    }

    async createSampleGroup(data: SampleGroupMetadata): Promise<void> {
        const { error } = await this.supabase
            .from('sample_group_metadata')
            .insert(data);

        if (error) throw error;
    }

    async updateSampleGroup(data: SampleGroupMetadata): Promise<void> {
        const { error } = await this.supabase
            .from('sample_group_metadata')
            .update(data)
            .eq('id', data.id);

        if (error) throw error;
    }

    async deleteSampleGroup(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('sample_group_metadata')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async createFileNode(data: FileNode): Promise<void> {
        const { error } = await this.supabase
            .from('file_nodes')
            .insert(data);

        if (error) throw error;
    }

    async updateFileNode(data: FileNode): Promise<void> {
        const { error } = await this.supabase
            .from('file_nodes')
            .update(data)
            .eq('id', data.id);

        if (error) throw error;
    }

    async deleteFileNode(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('file_nodes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async syncFromRemote(table: string, orgId?: string, since?: number): Promise<any[]> {
        let query = this.supabase.from(table).select('*');

        if (orgId) {
            query = query.eq('org_id', orgId);
        }

        if (since) {
            query = query.gt('updated_at', new Date(since).toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async syncToRemote(data: any, table: string): Promise<void> {
        const { error } = await this.supabase
            .from(table)
            .upsert(data);

        if (error) throw error;
    }

    async verifySync(table: string, id: string): Promise<boolean> {
        const { data, error } = await this.supabase
            .from(table)
            .select('id')
            .eq('id', id)
            .single();

        if (error) return false;
        return !!data;
    }

    async syncProcessedData(entry: ProcessedDataEntry): Promise<void> {
        const { error } = await this.supabase
            .from('processed_data')
            .upsert(entry);

        if (error) throw error;
    }

    async uploadFile(file: File, path: string): Promise<string> {
        const { error } = await this.supabase.storage
            .from('files')
            .upload(path, file);

        if (error) throw error;
        return path;
    }

    async downloadFile(path: string): Promise<Blob> {
        const { data, error } = await this.supabase.storage
            .from('files')
            .download(path);

        if (error) throw error;
        if (!data) throw new Error('File not found');

        return data;
    }

    async getLocations(): Promise<SampleLocation[]> {
        const { data, error } = await this.supabase
            .from('sample_locations')
            .select('*');

        if (error) throw error;
        return data || [];
    }

    async updateLocation(location: SampleLocation): Promise<void> {
        const { error } = await this.supabase
            .from('sample_locations')
            .update(location)
            .eq('id', location.id);

        if (error) throw error;
    }
}