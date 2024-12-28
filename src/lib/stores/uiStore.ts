// src/lib/stores/uiStore.ts
import { create } from 'zustand';
import type { SampleLocation, FileNode } from '../types';

/** Processing Status Type (extend as you need) */
export type ProcessingStatus = 'Idle' | 'Processing' | 'Error' | 'Complete';

/** Single processing item shape */
interface ProcessingItem {
    status: ProcessingStatus;
    progress: number;  // 0..100 or any scale you prefer
    error?: string;    // If you want to store an error message
}

/** Dictionary for all processing items keyed by e.g. "sampleId:configId" */
type ProcessingMap = Record<string, ProcessingItem>;

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
    selectedLeftItem: FileNode | undefined;

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

    // Move Modal
    moveModalItemId: string | null;

    // Processing State
    processingMap: ProcessingMap;

    // Actions
    toggleLeftSidebar: (collapsed?: boolean) => void;
    toggleRightSidebar: (collapsed?: boolean) => void;
    setSelectedLeftItem: (item: FileNode | undefined) => void;
    setSelectedRightItem: (item: SampleLocation | null) => void;
    setLeftSidebarContextMenuState: (state: Partial<ContextMenuState>) => void;
    closeLeftSidebarContextMenu: () => void;
    setShowAccountActions: (show: boolean) => void;
    setErrorMessage: (message: string | null) => void;
    setFilters: (filters: Partial<Filters>) => void;
    resetFilters: () => void;
    showMoveModal: (itemId: string | null) => void;
    hideMoveModal: () => void;

    // Processing State Actions
    setProcessingState: (key: string, status: ProcessingStatus, progress?: number, error?: string) => void;
    clearProcessingState: (key: string) => void;
}

const initialFilters: Filters = {
    startDate: null,
    endDate: null,
    selectedLocations: [],
};

export const useUIStore = create<UIState>((set, _get) => ({
    // Initial States
    isLeftSidebarCollapsed: false,
    isRightSidebarCollapsed: true,
    selectedLeftItem: undefined,
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
    moveModalItemId: null,

    // Initialize processingMap as empty
    processingMap: {},

    // Actions
    toggleLeftSidebar: (collapsed) =>
        set((state) => ({
            isLeftSidebarCollapsed:
                collapsed !== undefined ? collapsed : !state.isLeftSidebarCollapsed,
        })),

    toggleRightSidebar: (collapsed) =>
        set((state) => ({
            isRightSidebarCollapsed:
                collapsed !== undefined ? collapsed : !state.isRightSidebarCollapsed,
        })),

    setSelectedLeftItem: (item) =>
        set({
            selectedLeftItem: item || undefined,
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

    showMoveModal: (itemId: string | null) =>
        set({ moveModalItemId: itemId }),

    hideMoveModal: () =>
        set({ moveModalItemId: null }),

    // Processing State Actions
    setProcessingState: (key, status, progress = 0, error) =>
        set((state) => ({
            processingMap: {
                ...state.processingMap,
                [key]: {
                    status,
                    progress,
                    error,
                },
            },
        })),

    clearProcessingState: (key) =>
        set((state) => {
            const newMap = { ...state.processingMap };
            delete newMap[key];
            return { processingMap: newMap };
        }),
}));
