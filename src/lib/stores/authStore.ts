import { create } from 'zustand';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { db } from '../powersync/db';

interface UserProfile {
    id: string;
    organization_id: string;
    user_tier: string;
    created_at: string;
}

interface Organization {
    id: string;
    name: string;
    short_id: string;
}

interface AuthState {
    client: SupabaseClient;
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    error: string | null;
    loading: boolean;
    initialized: boolean;
    // Actions
    initializeAuth: () => Promise<void>;
    login: (email: string, password: string) => Promise<{ storedLicenseKey?: string }>;
    signUp: (email: string, password: string, licenseKey: string) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    processLicenseKey: (licenseKey: string) => Promise<void>;
    setError: (error: string | null) => void;
}

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const useAuthStore = create<AuthState>((set, get) => ({
    client: supabase,
    user: null,
    userProfile: null,
    organization: null,
    error: null,
    loading: true,
    initialized: false,

    initializeAuth: async () => {
        try {
            set({ loading: true });
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) throw error;

            if (session?.user) {
                // Use PowerSync to get user profile
                const userProfile = await db.execute(`
                    SELECT * FROM user_profiles WHERE id = ?
                `, [session.user.id]);

                if (userProfile.length > 0) {
                    // Use PowerSync to get organization
                    const org = await db.execute(`
                        SELECT * FROM organizations WHERE id = ?
                    `, [userProfile[0].organization_id]);

                    set({
                        user: session.user,
                        userProfile: userProfile[0],
                        organization: org[0],
                        initialized: true
                    });
                }
            }
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Authentication error' });
        } finally {
            set({ loading: false });
        }
    },

    login: async (email: string, password: string) => {
        try {
            set({ loading: true, error: null });

            const { data: { session }, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (session?.user) {
                // Use PowerSync to get user profile
                const userProfile = await db.execute(`
                    SELECT * FROM user_profiles WHERE id = ?
                `, [session.user.id]);

                if (userProfile.length > 0) {
                    // Use PowerSync to get organization
                    const org = await db.execute(`
                        SELECT * FROM organizations WHERE id = ?
                    `, [userProfile[0].organization_id]);

                    set({
                        user: session.user,
                        userProfile: userProfile[0],
                        organization: org[0]
                    });

                    // Use PowerSync to check for stored license key
                    const licenseKey = await db.execute(`
                        SELECT key FROM license_keys 
                        WHERE organization_id = ? AND is_active = 1
                        LIMIT 1
                    `, [userProfile[0].organization_id]);

                    return { storedLicenseKey: licenseKey[0]?.key };
                }
            }
            return {};
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Login failed' });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    signUp: async (email: string, password: string, licenseKey: string) => {
        try {
            set({ loading: true, error: null });

            // Verify license key using PowerSync
            const license = await db.execute(`
                SELECT * FROM license_keys 
                WHERE key = ? AND is_active = 1
                LIMIT 1
            `, [licenseKey]);

            if (!license.length) {
                throw new Error('Invalid license key');
            }

            const { data: { user }, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        organization_id: license[0].organization_id
                    }
                }
            });

            if (error) throw error;

            if (user) {
                // Insert user profile using PowerSync
                await db.execute(`
                    INSERT INTO user_profiles (id, organization_id, user_tier, created_at)
                    VALUES (?, ?, ?, ?)
                `, [
                    user.id,
                    license[0].organization_id,
                    'researcher',
                    new Date().toISOString()
                ]);
            }
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Signup failed' });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    logout: async () => {
        try {
            set({ loading: true, error: null });
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            set({
                user: null,
                userProfile: null,
                organization: null
            });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Logout failed' });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    resetPassword: async (email: string) => {
        try {
            set({ loading: true, error: null });
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Password reset failed' });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    processLicenseKey: async (licenseKey: string) => {
        try {
            set({ loading: true, error: null });

            // Use PowerSync to verify license key
            const license = await db.execute(`
                SELECT * FROM license_keys 
                WHERE key = ? AND is_active = 1
                LIMIT 1
            `, [licenseKey]);

            if (!license.length) {
                throw new Error('Invalid license key');
            }

            // Additional license key processing logic here
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'License key processing failed' });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    setError: (error: string | null) => set({ error })
}));