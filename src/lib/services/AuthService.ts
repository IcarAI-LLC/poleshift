// lib/services/AuthService.ts
import { BaseService } from './BaseService';
import type { User, UserProfile, Organization } from '../types';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { IndexedDBStorage } from "../storage/IndexedDB";

/**
 * A constant variable representing the key used to store or retrieve
 * the license key from a storage mechanism, such as localStorage or
 * sessionStorage. This key is used as an identifier to access the
 * stored license information within the application, ensuring consistency
 * in how the license key data is labeled and retrieved.
 *
 * Value: 'stored_license_key'
 */
const LICENSE_KEY_STORAGE_KEY = 'stored_license_key';

/**
 * The AuthService class extends BaseService and provides methods for handling authentication,
 * such as signing in, signing up, resetting passwords, and managing user sessions and profiles.
 */
export class AuthService extends BaseService {
    protected storageKey: string = 'auth';

    constructor(
        private supabase: SupabaseClient,
        storage: IndexedDBStorage
    ) {
        super(storage);
    }

    /**
     * Retrieves the current user session. Attempts to fetch the session
     * using Supabase authentication. If the session cannot be fetched or
     * an error occurs, it attempts to retrieve the session from local storage.
     * If a session is successfully retrieved, it updates the local storage.
     *
     * @return {Promise<Session | null>} A promise that resolves to the current session
     * if available, or null if no session could be retrieved.
     */
    async getSession(): Promise<Session | null> {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error || !session) {
                console.error('Session fetch error:', error);

                // Attempt to retrieve session from local storage
                const localSession = await this.storage.getSession();
                if (localSession) {
                    return localSession;
                }

                return null;
            }

            // Update local session
            await this.storage.saveSession(session);

            return session;
        } catch (error) {
            console.error('GetSession error:', error);

            // Attempt to retrieve session from local storage
            const localSession = await this.storage.getSession();
            if (localSession) {
                return localSession;
            }

            return null;
        }
    }

    /**
     * Retrieves the current authenticated user from the Supabase auth service.
     * If no user is found, the method attempts to retrieve the user from local storage.
     * Updates local storage with the current user data if available.
     *
     * @return {Promise<User | null>} A promise that resolves to the current user object if authenticated,
     *                               or null if no authenticated user is found.
     */
    async getCurrentUser(): Promise<User | null> {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();

            if (error || !user) {
                // Attempt to retrieve user from local storage
                const localUser = await this.storage.getUser();
                if (localUser) {
                    return localUser;
                }
                return null;
            }

            const currentUser: User = {
                id: user.id,
                email: user.email || '',
                last_sign_in_at: user?.last_sign_in_at || null
            };

            // Update local user data
            await this.storage.saveUser(currentUser);

            return currentUser;
        } catch (error) {
            console.error('GetUser error:', error);

            // Attempt to retrieve user from local storage
            const localUser = await this.storage.getUser();
            if (localUser) {
                return localUser;
            }

            return null;
        }
    }

    // Get session from local storage
    /**
     * Retrieves the local session from storage if it is valid and not expired.
     *
     * Attempts to fetch the current session stored in local storage. It checks
     * whether the session is still valid based on its expiration timestamp.
     * If the session is valid, it returns the session object. If the session
     * has expired or an error occurs during retrieval, it returns null.
     *
     * @return {Promise<Session | null>} A promise that resolves to the session
     * object if valid and not expired, or null if the session is expired
     * or an error occurs.
     */
    async getLocalSession(): Promise<Session | null> {
        try {
            const session = await this.storage.getSession();
            if (session && session.expires_at) {
                // Check if session is still valid
                if (new Date(session.expires_at * 1000) > new Date()) {
                    return session;
                } else {
                    // Session expired, remove from storage
                    await this.storage.removeSession();
                    return null;
                }
            }
            return null;
        } catch (error) {
            console.error('Error retrieving local session:', error);
            return null;
        }
    }

    // Get user from local storage
    /**
     * Retrieves the local user from storage.
     *
     * @return {Promise<User | null>} A promise that resolves to the user object if it exists, or null if it does not or if an error occurs.
     */
    async getLocalUser(): Promise<User | null> {
        try {
            const user = await this.storage.getUser();
            return user || null;
        } catch (error) {
            console.error('Error retrieving local user:', error);
            return null;
        }
    }

// lib/services/AuthService.ts

    /**
     * Signs in a user with the provided email and password.
     *
     * @param email - The email address of the user attempting to sign in.
     * @param password - The password associated with the given email.
     * @return An object containing the user details, user profile, associated organization (if any), and a stored license key or null.
     * @throws Will throw an error if sign-in fails or if no user or session is returned from the sign-in attempt.
     */
    async signIn(email: string, password: string): Promise<{
        user: User;
        profile: UserProfile;
        organization: Organization | undefined;
        storedLicenseKey: string | null;
    }> {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            if (!data.user || !data.session) throw new Error('No user or session returned from sign in');

            const user: User = {
                id: data.user.id,
                email: data.user.email || '',
                last_sign_in_at: data.user.last_sign_in_at || null
            };

            // **Add these lines to store session and user data locally**
            await this.storage.saveSession(data.session);
            await this.storage.saveUser(user);

            const profile = await this.getUserProfile(user.id);
            let organization: Organization | undefined;

            if (profile.organization_id) {
                organization = await this.getOrganization(profile.organization_id);
            }

            // Store profile and organization locally
            await this.storage.saveUserProfile(profile);
            if (organization) {
                await this.storage.saveOrganization(organization);
            }

            const storedLicenseKey = localStorage.getItem(LICENSE_KEY_STORAGE_KEY);

            return { user, profile, organization, storedLicenseKey };
        } catch (error) {
            console.error('SignIn error:', error);
            throw error;
        }
    }


    /**
     * Signs up a new user with an email, password, and license key. This method first validates the license key before proceeding with the user registration. If the license key is valid and active, it stores the key for post-signup processing and signs up the user through Supabase authentication.
     *
     * @param {string} email - The email address of the user to sign up.
     * @param {string} password - The password for the new user's account.
     * @param {string} licenseKey - The license key required for user registration, which will be validated for its existence and active status.
     * @return {Promise<void>} A promise that resolves when the sign-up process is complete, or throws an error if sign-up fails due to license key issues or authentication error.
     */
    async signUp(email: string, password: string, licenseKey: string): Promise<void> {
        try {
            // First verify the license key
            const { data: licenseData, error: licenseError } = await this.supabase
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
            localStorage.setItem(LICENSE_KEY_STORAGE_KEY, licenseKey);

            // Sign up the user
            const { error: signUpError } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        license_key: licenseKey
                    }
                }
            });

            if (signUpError) throw signUpError;
        } catch (error) {
            console.error('SignUp error:', error);
            throw error;
        }
    }

    /**
     * Initiates the password reset process for a given email address.
     *
     * @param email The email address for which the password reset should be initiated.
     * @return A Promise that resolves when the password reset process has been successfully initiated.
     * @throws Will throw an error if the password reset process fails.
     */
    async resetPassword(email: string): Promise<void> {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
        } catch (error) {
            console.error('Reset password error:', error);
            throw error;
        }
    }

    /**
     * Processes a given license key by checking its validity against a data source.
     * If the license key is found to be invalid or if an error occurs during the process,
     * an error is thrown. Once the license key is successfully processed, it is removed
     * from local storage.
     *
     * @param {string} licenseKey - The license key to be processed and validated.
     * @return {Promise<void>} A promise that resolves if the license key is valid,
     *                         otherwise it rejects with an error.
     */
    async processLicenseKey(licenseKey: string): Promise<void> {
        try {
            const { data: licenseData, error: licenseError } = await this.supabase
                .from('license_keys')
                .select('*')
                .eq('key', licenseKey)
                .single();

            if (licenseError || !licenseData) {
                throw new Error('Invalid license key');
            }

            // Clear the stored license key after processing
            localStorage.removeItem(LICENSE_KEY_STORAGE_KEY);
        } catch (error) {
            console.error('Process license key error:', error);
            throw error;
        }
    }

    /**
     * Retrieves the user profile for the given user ID. The method first attempts to fetch the profile from local storage.
     * If not found locally, it fetches the profile from the remote database, saves it to local storage, and then returns it.
     *
     * @param {string} userId - The unique identifier of the user whose profile is to be retrieved.
     * @return {Promise<UserProfile>} A promise that resolves to the UserProfile object of the specified user.
     * @throws {Error} If there is an error retrieving the user profile from either local or remote sources.
     */
    async getUserProfile(userId: string): Promise<UserProfile> {
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

            // Save to local storage
            await this.storage.saveUserProfile(data);
            return data;
        } catch (error) {
            console.error('GetUserProfile error:', error);
            throw error;
        }
    }

    /**
     * Retrieves an organization by its ID. The method first attempts to get the organization
     * from local storage. If not found locally, it fetches the organization data from a remote
     * database. If the organization is retrieved from the remote source, it is saved to local
     * storage for future access.
     *
     * @param {string} orgId - The unique identifier of the organization to be retrieved.
     * @return {Promise<Organization>} A promise that resolves to the organization object if found,
     * or rejects with an error if the organization is not found or if there is an issue accessing the data.
     */
    async getOrganization(orgId: string): Promise<Organization> {
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

            // Save to local storage
            await this.storage.saveOrganization(data);
            return data;
        } catch (error) {
            console.error('GetOrganization error:', error);
            throw error;
        }
    }

    /**
     * Signs the user out from the application by terminating the current session and clearing relevant stored data.
     * It interacts with the authentication service to log the user out, clears specific data from local storage,
     * and manages any errors that occur during the sign-out process.
     *
     * @return {Promise<void>} A promise that resolves when the sign-out process is completed successfully.
     *                          If an error occurs during the process, it will be logged to the console and re-thrown.
     */
    async signOut(): Promise<void> {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;

            // Clear local storage
            await this.storage.clearStore('user_profiles');
            await this.storage.clearStore('organizations');
            await this.storage.removeSession();
            await this.storage.removeUser();
            localStorage.removeItem(LICENSE_KEY_STORAGE_KEY);
        } catch (error) {
            console.error('SignOut error:', error);
            throw error;
        }
    }
}