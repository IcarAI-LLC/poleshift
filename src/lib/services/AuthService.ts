// lib/services/AuthService.ts
import { BaseService } from './BaseService';
import type { User, UserProfile, Organization } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
//@ts-ignore
import { IndexedDBStorage } from "../storage/IndexedDB.ts";

export class AuthService extends BaseService {
    protected storageKey: string = 'auth';

    constructor(
        private supabase: SupabaseClient,
        storage: IndexedDBStorage
    ) {
        super(storage);
    }

    async signIn(email: string, password: string): Promise<{
        profile: UserProfile;
        organization: Organization | undefined;
        user: User
    }> {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;

            const user = data.user;
            if (!user) {
                throw new Error('User not found after sign-in');
            }

            const profile = await this.getUserProfile(user.id);
            let organization: Organization | undefined;

            if (profile.organization_id) {
                organization = await this.getOrganization(profile.organization_id);
            }

            // Store locally
            await this.storage.saveUserProfile(profile);
            if (organization) {
                await this.storage.saveOrganization(organization);
            }
            if (!user){
                return { user, profile, organization };
            }
            return {user: {id: "", email: "", last_sign_in_at: null}, profile, organization };
        } catch (error) {
            this.handleError(error, 'Sign in failed');
            throw error; // Re-throw the error after handling
        }
    }

    async signOut(): Promise<void> {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;

            // Clear local storage
            await this.storage.clearStore('userProfiles');
            await this.storage.clearStore('organizations');
        } catch (error) {
            this.handleError(error, 'Sign out failed');
            throw error; // Re-throw the error after handling
        }
    }

    async getSession(): Promise<any> { // Specify the actual session type if available
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            if (error) throw error;
            return session;
        } catch (error) {
            this.handleError(error, 'Failed to get session');
            throw error; // Re-throw the error after handling
        }
    }

    private async getUserProfile(userId: string): Promise<UserProfile> {
        try {
            // Try local first
            const localProfile = await this.storage.getUserProfile(userId);
            if (localProfile) return localProfile;

            // Fetch from remote
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            if (!data) throw new Error('User profile not found');

            return data;
        } catch (error) {
            this.handleError(error, 'Failed to get user profile');
            throw error; // Re-throw the error after handling
        }
    }

    private async getOrganization(orgId: string): Promise<Organization> {
        try {
            // Try local first
            const localOrg = await this.storage.getOrganization(orgId);
            if (localOrg) return localOrg;

            // Fetch from remote
            const { data, error } = await this.supabase
                .from('organizations')
                .select('*')
                .eq('id', orgId)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Organization not found');

            return data;
        } catch (error) {
            this.handleError(error, 'Failed to get organization');
            throw error; // Re-throw the error after handling
        }
    }
}
