// src/lib/stores/authStore.ts

import { create } from 'zustand';
import {User, UserRole, PoleshiftPermissions} from '@/types';

interface AuthState {
    user: User | null;
    userId: string | null;
    organizationId: string | null;
    userPermissions: PoleshiftPermissions[] | null
    role: UserRole | null;
    error: string | null;
    loading: boolean;

    // Actions
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    setUser: (user: User | null) => void;
    setUserId: (userId: string | null) => void;
    setRole: (role: UserRole | null) => void;
    setOrganizationId: (organizationId: string | null) => void;
    setPermissions: (userPermissions: null | PoleshiftPermissions[]) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    userId: null,
    role: null,
    error: null,
    loading: false,
    organizationId: null,
    userPermissions: null,

    setUserId: (userId: string | null) => set({ userId }),
    setError: (error: string | null) => set({ error }),
    setLoading: (loading: boolean) => set({ loading }),
    setUser: (user: User | null) => set({ user }),
    setRole: (role: UserRole | null) => set({ role: role }),
    setOrganizationId: (organizationId: string | null) => set({ organizationId }),
    setPermissions: (userPermissions: PoleshiftPermissions[] | null) => set({ userPermissions: userPermissions }),
}));
