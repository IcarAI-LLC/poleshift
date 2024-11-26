// lib/contexts/AuthContext.tsx

import { createContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile, Organization, mapSupabaseUser } from '../types';
import { api } from '../api';
import { Session } from '@supabase/supabase-js';

export interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    userTier: string;
    userLevel: number;
    userOrg: string | null;
    userOrgId: string | null;
    userOrgShortId: string | null;
    loading: boolean;
    error: string | null;
    handleLogout: () => Promise<void>;
    setErrorMessage: (message: string | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const userTierMap: Record<string, number> = {
    admin: 3,
    lead: 2,
    researcher: 1,
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userTier, setUserTier] = useState<string>("none");
    const [userLevel, setUserLevel] = useState(0);
    const [userOrg, setUserOrg] = useState<string | null>(null);
    const [userOrgId, setUserOrgId] = useState<string | null>(null);
    const [userOrgShortId, setUserOrgShortId] = useState<string | null>(null);

    const resetUserState = () => {
        setUser(null);
        setUserProfile(null);
        setOrganization(null);
        setUserTier("none");
        setUserLevel(0);
        setUserOrg(null);
        setUserOrgId(null);
        setUserOrgShortId(null);
    };

    const updateUserState = async (session: Session | null) => {
        const mappedUser = session?.user ? mapSupabaseUser(session.user) : null;
        setUser(mappedUser);

        if (mappedUser) {
            try {
                const userProfile = await api.auth.getUserProfile(mappedUser.id);
                if (userProfile.organization_id) {
                    const organization = await api.auth.getOrganization(userProfile.organization_id);
                    setUserOrg(organization.name);
                    setUserOrgId(organization.id);
                    setUserOrgShortId(organization.org_short_id);
                    setOrganization(organization);
                }
                setUserProfile(userProfile);
                setUserTier(userProfile.user_tier);
                setUserLevel(userTierMap[userProfile.user_tier] || 0);
                if (session) api.auth.persistSession(session);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update user state');
                resetUserState();
            }
        } else {
            resetUserState();
            api.auth.clearPersistedSession();
        }
    };

    useEffect(() => {
        const fetchSession = async () => {
            if (!navigator.onLine) {
                const session = api.auth.getPersistedSession();
                await updateUserState(session);
                setLoading(false);
                return;
            }

            try {
                const session = await api.auth.getSession();
                await updateUserState(session);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch session');
                resetUserState();
            } finally {
                setLoading(false);
            }
        };

        fetchSession();

        const authListener = api.auth.onAuthStateChange(async (session) => {
            await updateUserState(session);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleLogout = async () => {
        try {
            await api.auth.logout();
            resetUserState();
            api.auth.clearPersistedSession();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to logout');
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                userProfile,
                organization,
                userTier,
                userLevel,
                userOrg,
                userOrgId,
                userOrgShortId,
                loading,
                error,
                handleLogout,
                setErrorMessage: setError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}