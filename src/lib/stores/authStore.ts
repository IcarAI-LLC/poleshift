// src/lib/stores/authStore.ts

import { create } from 'zustand';
import {User, UserProfile, Organization, UserRole} from '../types';

interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    organizationId: string | null;
    role: UserRole | null;
    error: string | null;
    loading: boolean;

    // Actions
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    setUser: (user: User | null) => void;
    setUserProfile: (profile: UserProfile | null) => void;
    setOrganization: (org: Organization | null) => void;
    setRole: (role: UserRole | null) => void;
    setOrganizationId: (organizationId: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    userProfile: null,
    organization: null,
    role: null,
    error: null,
    loading: false,
    organizationId: null,

    setError: (error: string | null) => set({ error }),
    setLoading: (loading: boolean) => set({ loading }),
    setUser: (user: User | null) => set({ user }),
    setUserProfile: (profile: UserProfile | null) => set({ userProfile: profile }),
    setOrganization: (org: Organization | null) => set({ organization: org }),
    setRole: (role: UserRole | null) => set({ role: role }),
    setOrganizationId: (organizationId: string | null) => set({ organizationId }),
}));
