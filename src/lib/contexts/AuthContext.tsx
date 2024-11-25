// lib/contexts/AuthContext.tsx

import { createContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile, Organization, mapSupabaseUser } from '../types';
import { api } from '../api';
import supabase from '../../old_utils/supabaseClient';
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
                const organization = await api.auth.getOrganization(userProfile.organization_id);

                setUserProfile(userProfile);
                setOrganization(organization);
                setUserTier(userProfile.user_tier);
                setUserLevel(userTierMap[userProfile.user_tier] || 0);
                setUserOrg(organization.name);
                setUserOrgId(organization.id);
                setUserOrgShortId(organization.org_short_id);

                window.localStorage.setItem('supabaseSession', JSON.stringify(session));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update user state');
                resetUserState();
            }
        } else {
            resetUserState();
            window.localStorage.removeItem('supabaseSession');
        }
    };

    useEffect(() => {
        const fetchSession = async () => {
            if (!navigator.onLine) {
                const cachedSessionStr = window.localStorage.getItem('supabaseSession');
                if (cachedSessionStr) {
                    const session = JSON.parse(cachedSessionStr) as Session;
                    await updateUserState(session);
                } else {
                    resetUserState();
                }
                setLoading(false);
                return;
            }

            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                await updateUserState(session);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch session');
                resetUserState();
            } finally {
                setLoading(false);
            }
        };

        fetchSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                await updateUserState(session);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleLogout = async () => {
        try {
            await api.auth.logout();
            resetUserState();
            window.localStorage.removeItem('supabaseSession');
            window.localStorage.removeItem('userDetails');
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