// src/lib/stores/uiStore.ts

import { create } from 'zustand';
import type { SampleLocation, FileNode } from '../types';

interface ContextMenuState {
    isVisible: boolean;
    x: number;
    y: number;
    itemId: string | null;
}

interface Filters {
    startDate: string | null;
    endDate: string | null;
    selectedLocations: string[];
}

interface UIState {
    // Left Sidebar State
    isLeftSidebarCollapsed: boolean;
    selectedLeftItem: FileNode | null;

    // Right Sidebar State
    isRightSidebarCollapsed: boolean;
    selectedRightItem: SampleLocation | null;

    // Context Menu State for Left Sidebar
    leftSidebarContextMenu: ContextMenuState;

    // Account Actions State
    showAccountActions: boolean;

    // Error Message State
    errorMessage: string | null;

    // Filter State
    filters: Filters;

    // Actions
    toggleLeftSidebar: (collapsed?: boolean) => void;
    toggleRightSidebar: (collapsed?: boolean) => void;
    setSelectedLeftItem: (item: FileNode | null) => void;
    setSelectedRightItem: (item: SampleLocation | null) => void;

    // Context Menu Actions for Left Sidebar
    setLeftSidebarContextMenuState: (state: Partial<ContextMenuState>) => void;
    closeLeftSidebarContextMenu: () => void;

    setShowAccountActions: (show: boolean) => void;
    setErrorMessage: (message: string | null) => void;
    setFilters: (filters: Partial<Filters>) => void;
    resetFilters: () => void;
}

const initialFilters: Filters = {
    startDate: null,
    endDate: null,
    selectedLocations: [],
};
//@ts-ignore
export const useUIStore = create<UIState>((set, get) => ({
    // Initial States
    isLeftSidebarCollapsed: false,
    isRightSidebarCollapsed: true,
    selectedLeftItem: null,
    selectedRightItem: null,
    leftSidebarContextMenu: {
        isVisible: false,
        x: 0,
        y: 0,
        itemId: null,
    },
    showAccountActions: false,
    errorMessage: null,
    filters: initialFilters,

    // Actions
    toggleLeftSidebar: (collapsed) => set((state) => ({
        isLeftSidebarCollapsed:
            collapsed !== undefined ? collapsed : !state.isLeftSidebarCollapsed,
    })),

    toggleRightSidebar: (collapsed) => set((state) => ({
        isRightSidebarCollapsed:
            collapsed !== undefined ? collapsed : !state.isRightSidebarCollapsed,
    })),

    setSelectedLeftItem: (item) => set({
        selectedLeftItem: item,
    }),

    setSelectedRightItem: (item) => {
        set({
            selectedRightItem: item,
            isRightSidebarCollapsed: item === null,
        });
    },

    setLeftSidebarContextMenuState: (newState) =>
        set((state) => ({
            leftSidebarContextMenu: {
                ...state.leftSidebarContextMenu,
                ...newState,
            },
        })),

    closeLeftSidebarContextMenu: () =>
        set((state) => ({
            leftSidebarContextMenu: {
                ...state.leftSidebarContextMenu,
                isVisible: false,
                itemId: null,
            },
        })),

    setShowAccountActions: (show) =>
        set({
            showAccountActions: show,
        }),

    setErrorMessage: (message) =>
        set({
            errorMessage: message,
        }),

    setFilters: (newFilters) =>
        set((state) => ({
            filters: {
                ...state.filters,
                ...newFilters,
            },
        })),

    resetFilters: () =>
        set({
            filters: initialFilters,
        }),
}));
