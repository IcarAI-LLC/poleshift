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
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    userId: null,
    role: null,
    error: null,
    loading: false,
    organizationId: null,
    userPermissions: null,

    setError: (error: string | null) => set({ error }),
}));
