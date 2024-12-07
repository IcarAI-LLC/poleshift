// src/lib/stores/authStore.ts

import { create } from 'zustand';
import type { User, UserProfile, Organization } from '../types';

interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    organization: Organization | null;
    error: string | null;
    loading: boolean;

    // Actions
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    setUser: (user: User | null) => void;
    setUserProfile: (profile: UserProfile | null) => void;
    setOrganization: (org: Organization | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    userProfile: null,
    organization: null,
    error: null,
    loading: false,

    setError: (error: string | null) => set({ error }),
    setLoading: (loading: boolean) => set({ loading }),
    setUser: (user: User | null) => set({ user }),
    setUserProfile: (profile: UserProfile | null) => set({ userProfile: profile }),
    setOrganization: (org: Organization | null) => set({ organization: org }),
}));
