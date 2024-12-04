import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User, UserProfile, Organization } from '../types';
import { supabase } from '../supabase/client';
import { storage } from '../services';

interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    isLoading: boolean;
    error: string | null;
}

interface AuthActions {
    signIn: (email: string, password: string) => Promise<{
        storedLicenseKey: string | null;
    }>;
    signUp: (email: string, password: string, licenseKey: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    processLicenseKey: (licenseKey: string) => Promise<void>;
    initializeAuth: () => Promise<void>;
    setError: (error: string | null) => void;
    clearAuth: () => void;
}

const initialState: AuthState = {
    user: null,
    userProfile: null,
    organization: null,
    isLoading: false,
    error: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
    devtools(
        persist(
            (set, get) => ({
                ...initialState,

                setError: (error) => set({ error }),

                clearAuth: () => {
                    set(initialState);
                },

                signIn: async (email: string, password: string) => {
                    set({ isLoading: true, error: null });

                    try {
                        const { data, error } = await supabase.auth.signInWithPassword({
                            email,
                            password,
                        });

                        if (error) throw error;
                        if (!data.user || !data.session) {
                            throw new Error('No user or session returned from sign in');
                        }

                        const user: User = {
                            id: data.user.id,
                            email: data.user.email || '',
                            last_sign_in_at: data.user.last_sign_in_at || null,
                        };

                        // Save session and user to local storage
                        await storage.saveSession(data.session);
                        await storage.saveUser(user);

                        // Get user profile
                        const { data: profileData, error: profileError } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', user.id)
                            .single();

                        if (profileError) throw profileError;

                        // Get organization if user has one
                        let organization = null;
                        if (profileData.organization_id) {
                            const { data: orgData, error: orgError } = await supabase
                                .from('organizations')
                                .select('*')
                                .eq('id', profileData.organization_id)
                                .single();

                            if (orgError) throw orgError;
                            organization = orgData;
                            await storage.saveOrganization(orgData);
                        }

                        await storage.saveUserProfile(profileData);

                        set({
                            user,
                            userProfile: profileData,
                            organization,
                            isLoading: false,
                            error: null,
                        });

                        const storedLicenseKey = localStorage.getItem('stored_license_key');
                        return { storedLicenseKey };

                    } catch (error: any) {
                        set({
                            error: error.message,
                            isLoading: false,
                        });
                        throw error;
                    }
                },

                signUp: async (email: string, password: string, licenseKey: string) => {
                    set({ isLoading: true, error: null });

                    try {
                        // Verify license key first
                        const { data: licenseData, error: licenseError } = await supabase
                            .from('license_keys')
                            .select('*')
                            .eq('key', licenseKey)
                            .single();

                        if (licenseError || !licenseData) {
                            throw new Error('Invalid license key');
                        }

                        if (!licenseData.is_active) {
                            throw new Error('License key is inactive');
                        }

                        // Store license key for post-signup processing
                        localStorage.setItem('stored_license_key', licenseKey);

                        const { error: signUpError } = await supabase.auth.signUp({
                            email,
                            password,
                            options: {
                                data: {
                                    license_key: licenseKey,
                                },
                            },
                        });

                        if (signUpError) throw signUpError;

                        set({ isLoading: false, error: null });
                    } catch (error: any) {
                        set({
                            error: error.message,
                            isLoading: false,
                        });
                        throw error;
                    }
                },

                signOut: async () => {
                    set({ isLoading: true, error: null });

                    try {
                        const { error } = await supabase.auth.signOut();
                        if (error) throw error;

                        // Clear local storage
                        await storage.clearStore('user_profiles');
                        await storage.clearStore('organizations');
                        await storage.removeSession();
                        await storage.removeUser();
                        localStorage.removeItem('stored_license_key');

                        set(initialState);
                    } catch (error: any) {
                        set({
                            error: error.message,
                            isLoading: false,
                        });
                        throw error;
                    }
                },

                resetPassword: async (email: string) => {
                    set({ isLoading: true, error: null });

                    try {
                        const { error } = await supabase.auth.resetPasswordForEmail(email);
                        if (error) throw error;
                        set({ isLoading: false });
                    } catch (error: any) {
                        set({
                            error: error.message,
                            isLoading: false,
                        });
                        throw error;
                    }
                },

                processLicenseKey: async (licenseKey: string) => {
                    set({ isLoading: true, error: null });

                    try {
                        const { data, error } = await supabase
                            .from('license_keys')
                            .select('*')
                            .eq('key', licenseKey)
                            .single();

                        if (error || !data) {
                            throw new Error('Invalid license key');
                        }

                        localStorage.removeItem('stored_license_key');
                        set({ isLoading: false });
                    } catch (error: any) {
                        set({
                            error: error.message,
                            isLoading: false,
                        });
                        throw error;
                    }
                },

                initializeAuth: async () => {
                    set({ isLoading: true, error: null });

                    try {
                        // Check for existing session
                        const { data: { session }, error: sessionError } =
                            await supabase.auth.getSession();

                        if (sessionError) throw sessionError;

                        if (!session) {
                            // Try to get session from storage
                            const storedSession = await storage.getSession();
                            if (!storedSession) {
                                set({ ...initialState, isLoading: false });
                                return;
                            }
                        }

                        // Get current user
                        const { data: { user }, error: userError } =
                            await supabase.auth.getUser();

                        if (userError) throw userError;
                        if (!user) {
                            set({ ...initialState, isLoading: false });
                            return;
                        }

                        const currentUser: User = {
                            id: user.id,
                            email: user.email || '',
                            last_sign_in_at: user.last_sign_in_at || null,
                        };

                        // Get user profile
                        const { data: profile, error: profileError } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', user.id)
                            .single();

                        if (profileError) throw profileError;

                        // Get organization if user has one
                        let organization = null;
                        if (profile.organization_id) {
                            const { data: org, error: orgError } = await supabase
                                .from('organizations')
                                .select('*')
                                .eq('id', profile.organization_id)
                                .single();

                            if (orgError) throw orgError;
                            organization = org;
                        }

                        set({
                            user: currentUser,
                            userProfile: profile,
                            organization,
                            isLoading: false,
                            error: null,
                        });
                    } catch (error: any) {
                        set({
                            error: error.message,
                            isLoading: false,
                        });
                        throw error;
                    }
                },
            }),
            {
                name: 'auth-storage',
                partialize: (state) => ({
                    user: state.user,
                    userProfile: state.userProfile,
                    organization: state.organization,
                }),
            }
        )
    )
);