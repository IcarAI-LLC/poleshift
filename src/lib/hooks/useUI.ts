import { useUIStore } from '../stores';

export function useUI() {
    const {
        selectedLeftItem,
        selectedRightItem,
        isSidebarCollapsed,
        isRightSidebarCollapsed,
        showAccountActions,
        errorMessage,
        filters,
        modal,
        contextMenu,
        setSelectedLeftItem,
        setSelectedRightItem,
        toggleSidebar,
        toggleRightSidebar,
        setShowAccountActions,
        setErrorMessage,
        setFilters,
        setModalState,
        setContextMenuState,
        closeContextMenu
    } = useUIStore();

    return {
        selectedLeftItem,
        selectedRightItem,
        isSidebarCollapsed,
        isRightSidebarCollapsed,
        showAccountActions,
        errorMessage,
        filters,
        modal,
        contextMenu,
        setSelectedLeftItem,
        setSelectedRightItem,
        toggleSidebar,
        toggleRightSidebar,
        setShowAccountActions,
        setErrorMessage,
        setFilters,
        setModalState,
        setContextMenuState,
        closeContextMenu
    };
}