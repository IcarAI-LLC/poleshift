// lib/contexts/UIContext.tsx

import React, { createContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { TreeItem, Location } from '../types';
import { UIState } from '../types';

// Define the structure for modal state
export interface ModalState {
    isOpen: boolean;
    title: string;
    type: 'input' | 'data';
    configItem?: any;
    modalInputs?: Record<string, string>;
    data?: any;
}

// Define the structure for confirmation dialogs
export interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    callback: () => void;
}

// Define the structure for context menus
export interface ContextMenuState {
    isVisible: boolean;
    x: number;
    y: number;
    itemId: string | null;
}

// Define the structure of the UI context
export interface UIContextType {
    // Sidebar States
    selectedLeftItem: TreeItem | null;
    setSelectedLeftItem: React.Dispatch<React.SetStateAction<TreeItem | null>>;
    selectedRightItem: Location | null;
    setSelectedRightItem: React.Dispatch<React.SetStateAction<Location | null>>;
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
    isRightSidebarCollapsed: boolean;
    toggleRightSidebar: () => void;
    openRightSidebar: () => void;
    closeRightSidebar: () => void;

    // Modal States
    modal: ModalState;
    setModalState: (modalState: ModalState) => void;

    // Confirmation Dialog States
    confirmState: ConfirmState;
    setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;

    // Context Menu States
    contextMenuState: ContextMenuState;
    setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState>>;

    // Account Actions
    showAccountActions: boolean;
    setShowAccountActions: React.Dispatch<React.SetStateAction<boolean>>;

    // Error Handling
    errorMessage: string;
    setErrorMessage: React.Dispatch<React.SetStateAction<string>>;

    // Filter States
    filters: UIState['filters'];
    setFilters: React.Dispatch<React.SetStateAction<UIState['filters']>>;
}

export const UIContext = createContext<UIContextType | undefined>(undefined);

interface UIProviderProps {
    children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
    // Sidebar States
    const [selectedLeftItem, setSelectedLeftItem] = useState<TreeItem | null>(null);
    const [selectedRightItem, setSelectedRightItem] = useState<Location | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
    const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState<boolean>(true);

    // Modal States
    const [modal, setModal] = useState<ModalState>({
        isOpen: false,
        title: '',
        type: 'input',
        configItem: undefined,
        modalInputs: {},
        data: undefined
    });

    // Confirmation Dialog States
    const [confirmState, setConfirmState] = useState<ConfirmState>({
        isOpen: false,
        title: '',
        message: '',
        callback: () => {}
    });

    // Context Menu States
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
        isVisible: false,
        x: 0,
        y: 0,
        itemId: null
    });

    // Account Actions State
    const [showAccountActions, setShowAccountActions] = useState<boolean>(false);

    // Error Message State
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Filter States
    const [filters, setFilters] = useState<UIState['filters']>({
        startDate: null,
        endDate: null,
        selectedLocations: []
    });

    // Sidebar Actions
    const toggleSidebar = useCallback(() => {
        setIsSidebarCollapsed(prev => !prev);
    }, []);

    const toggleRightSidebar = useCallback(() => {
        setIsRightSidebarCollapsed(prev => !prev);
    }, []);

    const openRightSidebar = useCallback(() => {
        setIsRightSidebarCollapsed(false);
    }, []);

    const closeRightSidebar = useCallback(() => {
        setIsRightSidebarCollapsed(true);
    }, []);

    // Set Modal State
    const setModalState = useCallback((newState: ModalState) => {
        setModal(newState);
    }, []);

    // Memoize the context value
    const value = useMemo(() => ({
        // Sidebar States
        selectedLeftItem,
        setSelectedLeftItem,
        selectedRightItem,
        setSelectedRightItem,
        isSidebarCollapsed,
        toggleSidebar,
        isRightSidebarCollapsed,
        toggleRightSidebar,
        openRightSidebar,
        closeRightSidebar,

        // Modal States
        modal,
        setModalState,

        // Confirmation Dialog States
        confirmState,
        setConfirmState,

        // Context Menu States
        contextMenuState,
        setContextMenuState,

        // Account Actions
        showAccountActions,
        setShowAccountActions,

        // Error Handling
        errorMessage,
        setErrorMessage,

        // Filter States
        filters,
        setFilters,
    }), [
        selectedLeftItem,
        selectedRightItem,
        isSidebarCollapsed,
        isRightSidebarCollapsed,
        modal,
        confirmState,
        contextMenuState,
        showAccountActions,
        errorMessage,
        filters,
        toggleSidebar,
        toggleRightSidebar,
        openRightSidebar,
        closeRightSidebar,
        setModalState
    ]);

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}