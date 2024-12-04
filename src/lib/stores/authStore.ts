// src/lib/hooks/authStore.ts

import { create } from 'zustand';
import { db, setupPowerSync } from '../powersync/db';
import type { User } from '../types';
import { SupabaseConnector } from '../powersync/SupabaseConnector';

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
    connector: SupabaseConnector | null;
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

export const useAuthStore = create<AuthState>((set, get) => ({
    connector: null,
    user: null,
    userProfile: null,
    organization: null,
    error: null,
    loading: true,
    initialized: false,

    initializeAuth: async () => {
        try {
            console.log('Initializing authentication...');
            set({ loading: true, error: null });

            const connector = new SupabaseConnector();

            // Register session listeners before initializing the connector
            connector.registerListener({
                sessionStarted: async (session) => {
                    try {
                        console.log('Session started:', session);
                        if (session?.user) {
                            let userProfile = await db.get(
                                `SELECT * FROM user_profiles WHERE id = ?`,
                                [session.user.id]
                            );

                            if (userProfile.length === 0) {
                                // No user profile found, create one
                                console.log('No user profile found. Creating one...');
                                await db.execute(
                                    `INSERT INTO user_profiles (id, organization_id, user_tier, created_at) VALUES (?, ?, ?, ?)`,
                                    [
                                        session.user.id,
                                        'default_org_id', // Replace with logic to determine organization_id
                                        'researcher', // Default user tier
                                        new Date().toISOString()
                                    ]
                                );
                                // Fetch the newly created profile
                                userProfile = await db.execute(
                                    `SELECT * FROM user_profiles WHERE id = ?`,
                                    [session.user.id]
                                );
                            }

                            // Proceed as before
                            const org = await db.get(
                                `SELECT * FROM organizations WHERE id = ?`,
                                [userProfile.organization_id]
                            );

                            set({
                                user: session.user,
                                userProfile: userProfile,
                                organization: org,
                                initialized: true,
                                loading: false
                            });
                        } else {
                            // Handle case where session has no user
                            set({
                                user: null,
                                userProfile: null,
                                organization: null,
                                initialized: true,
                                loading: false
                            });
                        }
                    } catch (error) {
                        console.error('Error in sessionStarted listener:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Session processing error',
                            loading: false,
                            initialized: true
                        });
                    }
                },
                sessionEnded: () => {
                    console.log('Session ended. Redirecting to login.');
                    set({
                        user: null,
                        userProfile: null,
                        organization: null,
                        initialized: true, // Ensure initialized remains true
                        loading: false // Ensure loading is false
                    });
                }
            });

            await connector.init(); // Now any session updates will trigger the listener

            // Set the connector in the state immediately
            set({ connector });

            console.log('SupabaseConnector initialized.');

            // **Add this line to connect db**
            await setupPowerSync(connector);
            console.log('PowerSync setup completed.');

            // If no session is found, set loading to false
            if (!get().user) {
                set({ loading: false });
            }

        } catch (error) {
            console.error('Error initializing authentication:', error);
            set({
                error: error instanceof Error ? error.message : 'Authentication error',
                loading: false,
                initialized: true // Ensure initialized is set to true even on error
            });
        }
    },

    login: async (email: string, password: string) => {
        try {
            set({ loading: true, error: null });

            const connector = get().connector;
            if (!connector) {
                throw new Error('Auth not initialized');
            }

            await connector.login(email, password);

            // After login, loading state will be updated by sessionStarted listener
            // So we don't need to set loading to false here

            // **No need to call setupPowerSync again here since it's already connected**

            const licenseKey = await db.execute(
                `SELECT key FROM license_keys WHERE organization_id = ? AND is_active = 1 LIMIT 1`,
                [get().userProfile?.organization_id]
            );

            return { storedLicenseKey: licenseKey[0]?.key };
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Login failed' });
            throw error;
        } finally {
            // Do not set loading to false here; sessionStarted will handle it
        }
    },

    signUp: async (email: string, password: string, licenseKey: string) => {
        try {
            set({ loading: true, error: null });

            const license = await db.execute(
                `SELECT * FROM license_keys WHERE key = ? AND is_active = 1 LIMIT 1`,
                [licenseKey]
            );

            if (!license.length) {
                throw new Error('Invalid license key');
            }

            const connector = get().connector;
            if (!connector) {
                throw new Error('Auth not initialized');
            }

            const user = await connector.client.auth.signUp({
                email,
                password,
                options: {
                    data: { organization_id: license[0].organization_id }
                }
            });

            if (!user.data.user) {
                throw new Error('Failed to create user');
            }

            await db.execute(
                `INSERT INTO user_profiles (id, organization_id, user_tier, created_at) VALUES (?, ?, ?, ?)`,
                [
                    user.data.user.id,
                    license[0].organization_id,
                    'researcher',
                    new Date().toISOString()
                ]
            );
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

            const connector = get().connector;
            if (!connector) {
                throw new Error('Auth not initialized');
            }

            await connector.logout();
            await db.disconnect();

            set({
                user: null,
                userProfile: null,
                organization: null,
                loading: false // Set loading to false here
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

            const connector = get().connector;
            if (!connector) {
                throw new Error('Auth not initialized');
            }

            await connector.client.auth.resetPasswordForEmail(email);
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

            const license = await db.execute(
                `SELECT * FROM license_keys WHERE key = ? AND is_active = 1 LIMIT 1`,
                [licenseKey]
            );

            if (!license.length) {
                throw new Error('Invalid license key');
            }
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'License key processing failed' });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    setError: (error: string | null) => set({ error })
}));
