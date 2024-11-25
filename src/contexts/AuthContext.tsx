// src/renderer/contexts/AuthContext.tsx

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import supabase from '../utils/supabaseClient';

export interface AuthContextType {
  user: any; // Replace `any` with your user type
  userTier: string | null;
  userLevel: number;
  userOrg: string | null;
  userOrgId: string | null;
  userOrgShortId: string | null;
  loading: boolean;
  handleLogout: () => Promise<void>;
  errorMessage: string;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const userTierMap: Record<string, number> = {
  admin: 3,
  lead: 2,
  researcher: 1,
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<any>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [userOrg, setUserOrg] = useState<string | null>(null);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [userOrgShortId, setUserOrgShortId] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const fetchSession = async () => {
      if (!navigator.onLine) {
        console.log('Offline: Cannot fetch session from Supabase.');
        // Optionally, load session from local storage if you have it saved
        const cachedSession = window.localStorage.getItem('supabaseSession');
        if (cachedSession) {
          const session = JSON.parse(cachedSession);
          setUser(session.user ?? null);
        } else {
          setUser(null);
        }
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          console.error('Error fetching session:', error);
        }
        setUser(session?.user ?? null);
        // Save session to local storage
        window.localStorage.setItem('supabaseSession', JSON.stringify(session));
      } catch (err) {
        console.error('Error in getSession:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('Auth state changed:', event, session);
          setUser(session?.user ?? null);
          // Save session to local storage
          window.localStorage.setItem('supabaseSession', JSON.stringify(session));
        }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!user) {
        setUserTier(null);
        setUserLevel(0);
        setUserOrg(null);
        setUserOrgId(null);
        setUserOrgShortId(null);
        return;
      }

      if (!navigator.onLine) {
        console.log('Offline: Cannot fetch user details from Supabase.');
        // Optionally, load user details from local storage
        const cachedUserDetails = window.localStorage.getItem('userDetails');
        if (cachedUserDetails) {
          const data = JSON.parse(cachedUserDetails);
          setUserTier(data.userTier);
          setUserLevel(data.userLevel);
          setUserOrg(data.userOrg);
          setUserOrgId(data.userOrgId);
          setUserOrgShortId(data.userOrgShortId);
        }
        return;
      }

      try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select(
                `
            user_tier,
            organization:organization_id!inner (
              id,
              name,
              org_short_id
            )
          `
            )
            .eq('id', user.id)
            .single();

        if (error || !data) {
          console.error('Error fetching user or organization details:', error);
          setUserTier(null);
          setUserLevel(0);
          setUserOrg(null);
          setUserOrgId(null);
          setUserOrgShortId(null);
        } else {
          console.log('User details:', data);

          setUserTier(data.user_tier);
          const level = userTierMap[data.user_tier] || 0;
          setUserLevel(level);
          let org = data.organization[0];
          setUserOrg(org.name || null);
          setUserOrgId(org.id|| null);
          setUserOrgShortId(org.org_short_id || null);

          // Save user details to local storage
          window.localStorage.setItem(
              'userDetails',
              JSON.stringify({
                userTier: data.user_tier,
                userLevel: level,
              })
          );
        }
      } catch (err) {
        console.error('Error in fetchUserDetails:', err);
        setUserTier(null);
        setUserLevel(0);
        setUserOrg(null);
        setUserOrgId(null);
        setUserOrgShortId(null);
      }
    };

    fetchUserDetails();
  }, [user]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error during logout:', error);
      setErrorMessage('An error occurred during logout. Please try again.');
    } else {
      setUser(null);
      setUserTier(null);
      setUserLevel(0);
      setUserOrg(null);
      setUserOrgId(null);
      setUserOrgShortId(null);
      // Clear cached data
      window.localStorage.removeItem('supabaseSession');
      window.localStorage.removeItem('userDetails');
    }
  };

  return (
      <AuthContext.Provider
          value={{
            user,
            userTier,
            userLevel,
            userOrg,
            userOrgId,
            userOrgShortId,
            loading,
            handleLogout,
            errorMessage,
            setErrorMessage,
          }}
      >
        {children}
      </AuthContext.Provider>
  );
}
