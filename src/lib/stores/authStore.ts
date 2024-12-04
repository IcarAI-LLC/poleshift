// src/lib/stores/authStore.ts

import { create } from 'zustand';
import { SupabaseConnector } from '../powersync/SupabaseConnector';
import type { User, UserProfile, Organization } from '../types';

interface AuthState {
    user: User | null;
    userProfile: UserProfile | null; // New state
    organization: Organization | null; // New state
    error: string | null;
    loading: boolean;

    // Actions
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    setUser: (user: User | null) => void;
    setUserProfile: (profile: UserProfile | null) => void; // New action
    setOrganization: (org: Organization | null) => void; // New action
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    userProfile: null, // Initialize new state
    organization: null, // Initialize new state
    error: null,
    loading: false,

    setError: (error: string | null) => set({ error }),
    setLoading: (loading: boolean) => set({ loading }),
    setUser: (user: User | null) => set({ user }),
    setUserProfile: (profile: UserProfile | null) => set({ userProfile: profile }), // Implement new action
    setOrganization: (org: Organization | null) => set({ organization: org }), // Implement new action
}));
