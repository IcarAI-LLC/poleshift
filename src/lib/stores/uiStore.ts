import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FileNode, SampleLocation, ModalState, ContextMenuState } from '../types';

interface UIState {
    selectedLeftItem: FileNode | null;
    selectedRightItem: SampleLocation | null;
    isSidebarCollapsed: boolean;
    isRightSidebarCollapsed: boolean;
    showAccountActions: boolean;
    errorMessage: string;
    filters: {
        startDate: string | null;
        endDate: string | null;
        selectedLocations: string[];
    };
    modal: ModalState;
    contextMenu: ContextMenuState;
}

interface UIActions {
    setSelectedLeftItem: (item: FileNode | null) => void;
    setSelectedRightItem: (item: SampleLocation | null) => void;
    toggleSidebar: (isCollapsed?: boolean) => void;
    toggleRightSidebar: (isCollapsed?: boolean) => void;
    setShowAccountActions: (show: boolean) => void;
    setErrorMessage: (message: string) => void;
    setFilters: (filters: UIState['filters']) => void;
    setModalState: (modalState: ModalState) => void;
    setContextMenuState: (contextMenu: ContextMenuState) => void;
    closeContextMenu: () => void;
}

const initialState: UIState = {
    selectedLeftItem: null,
    selectedRightItem: null,
    isSidebarCollapsed: false,
    isRightSidebarCollapsed: false,
    showAccountActions: false,
    errorMessage: '',
    filters: {
        startDate: null,
        endDate: null,
        selectedLocations: [],
    },
    modal: {
        isOpen: false,
        title: '',
        type: 'input',
        configItem: undefined,
        modalInputs: undefined,
        data: undefined
    },
    contextMenu: {
        isVisible: false,
        x: 0,
        y: 0,
        itemId: null
    }
};

export const useUIStore = create<UIState & UIActions>()(
    devtools(
        (set) => ({
            ...initialState,

            setSelectedLeftItem: (item) => set({ selectedLeftItem: item }),

            setSelectedRightItem: (item) => set({ selectedRightItem: item }),

            toggleSidebar: (isCollapsed) => set((state) => ({
                isSidebarCollapsed: isCollapsed !== undefined ? isCollapsed : !state.isSidebarCollapsed
            })),

            toggleRightSidebar: (isCollapsed) => set((state) => ({
                isRightSidebarCollapsed: isCollapsed !== undefined ? isCollapsed : !state.isRightSidebarCollapsed
            })),

            setShowAccountActions: (show) => set({ showAccountActions: show }),

            setErrorMessage: (message) => set({ errorMessage: message }),

            setFilters: (filters) => set({ filters }),

            setModalState: (modalState) => set({ modal: modalState }),

            setContextMenuState: (contextMenu) => set({ contextMenu }),

            closeContextMenu: () => set({
                contextMenu: {
                    isVisible: false,
                    x: 0,
                    y: 0,
                    itemId: null
                }
            }),
        }),
        {
            name: 'ui-store'
        }
    )
);