//src/lib/hooks/useUI.ts

import { useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';
import type { FileNode, SampleLocation } from '../types';

export const useUI = () => {
    const {
        isLeftSidebarCollapsed,
        isRightSidebarCollapsed,
        selectedLeftItem,
        selectedRightItem,
        contextMenu,
        showAccountActions,
        errorMessage,
        filters,
        toggleLeftSidebar,
        toggleRightSidebar,
        setSelectedLeftItem,
        setSelectedRightItem,
        setContextMenuState,
        closeContextMenu,
        setShowAccountActions,
        setErrorMessage,
        setFilters,
        resetFilters
    } = useUIStore();

    // Enhanced sidebar handlers
    const handleToggleLeftSidebar = useCallback(() => {
        toggleLeftSidebar();
    }, [toggleLeftSidebar]);

    const handleToggleRightSidebar = useCallback(() => {
        toggleRightSidebar();
    }, [toggleRightSidebar]);

    // Selection handlers with type safety
    const handleSelectLeftItem = useCallback((item: FileNode | null) => {
        setSelectedLeftItem(item);
    }, [setSelectedLeftItem]);

    const handleSelectRightItem = useCallback((item: SampleLocation | null) => {
        setSelectedRightItem(item);
        if (item) {
            toggleRightSidebar(false); // Open sidebar when item is selected
        }
    }, [setSelectedRightItem, toggleRightSidebar]);

    // Context menu handlers
    const handleContextMenu = useCallback((e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenuState({
            isVisible: true,
            x: e.clientX,
            y: e.clientY,
            itemId
        });
    }, [setContextMenuState]);

    const handleCloseContextMenu = useCallback(() => {
        closeContextMenu();
    }, [closeContextMenu]);

    // Error message handlers with timeout
    const handleSetErrorMessage = useCallback((message: string | null) => {
        setErrorMessage(message);
        if (message) {
            setTimeout(() => {
                setErrorMessage(null);
            }, 5000); // Clear error after 5 seconds
        }
    }, [setErrorMessage]);

    // Filter handlers with validation
    const handleSetFilters = useCallback((newFilters: Partial<typeof filters>) => {
        // Validate date ranges if both are provided
        if (newFilters.startDate && newFilters.endDate) {
            if (new Date(newFilters.startDate) > new Date(newFilters.endDate)) {
                handleSetErrorMessage('Start date cannot be after end date');
                return;
            }
        }
        setFilters(newFilters);
    }, [setFilters, handleSetErrorMessage]);

    return {
        // State
        isLeftSidebarCollapsed,
        isRightSidebarCollapsed,
        selectedLeftItem,
        selectedRightItem,
        contextMenu,
        showAccountActions,
        errorMessage,
        filters,

        // Enhanced actions
        toggleLeftSidebar: handleToggleLeftSidebar,
        toggleRightSidebar: handleToggleRightSidebar,
        setSelectedLeftItem: handleSelectLeftItem,
        setSelectedRightItem: handleSelectRightItem,
        handleContextMenu,
        closeContextMenu: handleCloseContextMenu,
        setShowAccountActions,
        setErrorMessage: handleSetErrorMessage,
        setFilters: handleSetFilters,
        resetFilters,

        // Utility getters
        hasSelectedItem: Boolean(selectedLeftItem || selectedRightItem),
        isContextMenuOpen: contextMenu.isVisible,
    };
};

export default useUI;