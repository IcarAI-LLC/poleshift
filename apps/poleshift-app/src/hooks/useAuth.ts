import { useAuthStore } from '@/stores/authStore.ts';
import { supabaseConnector } from '../lib/powersync/SupabaseConnector.ts';
import { useCallback, useMemo } from 'react';
import { usePowerSync, useQuery } from '@powersync/react';
import { Organizations, UserProfiles } from '@/types';
import {
  toCompilableQuery,
  wrapPowerSyncWithDrizzle,
} from '@powersync/drizzle-driver';
import {
  DrizzleSchema,
  organizations,
  user_profiles,
} from '../lib/powersync/DrizzleSchema.ts';
import { eq } from 'drizzle-orm';
import { setupPowerSync } from '@/lib/powersync/db.ts';

export const useAuth = () => {
  const {
    user,
    userId,
    error,
    loading,
    organizationId,
    setError,
    setLoading,
    setUser,
  } = useAuthStore();
  const db = usePowerSync();
  const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });
  const isAuthenticated = Boolean(user);
  const orgQuery = drizzleDB
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId || ''))
    .limit(1);
  const userProfileQuery = drizzleDB
    .select()
    .from(user_profiles)
    .where(eq(user_profiles.id, userId || ''))
    .limit(1);
  const compiledOrgQuery = toCompilableQuery(orgQuery);
  const compiledUserProfileQuery = toCompilableQuery(userProfileQuery);
  const userProfile: UserProfiles = useQuery(compiledUserProfileQuery).data[0];
  const organization: Organizations = useQuery(compiledOrgQuery).data[0];

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        await supabaseConnector.login(email, password);
        if (!db.connected) {
          await setupPowerSync();
        }
        const credentials = await supabaseConnector.client.auth.getSession();
        const user = credentials.data.session?.user;
        setUser(user || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading, setUser]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        // Pass the license key to your supabaseConnector:
        await supabaseConnector.signUp(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign up failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading]
  );

  const activateLicense = useCallback(
    async (licenseKey: string) => {
      if (!user) {
        throw new Error('No user is logged in');
      }

      try {
        setLoading(true);
        const response = await supabaseConnector.client.functions.invoke(
          'sign_up_with_license',
          {
            body: { userId: user.id, licenseKey },
          }
        );

        if (response.error) {
          throw new Error(
            response.error.message || 'License activation failed'
          );
        }
        console.log('remove');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'License activation failed'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, setError, setLoading]
  );

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setUser(null);
      await supabaseConnector.logout();
      await db.disconnectAndClear({ clearLocal: true });
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, setUser]);

  const resetApp = () => {
    try {
      setUser(null);
      localStorage.clear();
      db.disconnectAndClear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        setLoading(true);
        await supabaseConnector.resetPassword(email);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Password reset failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading]
  );

  return useMemo(
    () => ({
      user,
      userProfile,
      organization,
      error,
      loading,
      isAuthenticated,
      login,
      signUp,
      logout,
      resetApp,
      resetPassword,
      activateLicense,
      setError,
    }),
    [
      user,
      userProfile,
      organization,
      error,
      loading,
      isAuthenticated,
      login,
      signUp,
      logout,
      resetApp,
      resetPassword,
      activateLicense,
      setError,
    ]
  );
};
