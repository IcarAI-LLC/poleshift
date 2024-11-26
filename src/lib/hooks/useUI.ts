import { useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { FileNode, SampleLocation, ModalState, ContextMenuState, UIState } from '../types';

export function useUI() {
    const { state, dispatch } = useContext(AppContext);

    const setSelectedLeftItem = useCallback((item: FileNode | null) => {
        dispatch({ type: 'SET_SELECTED_LEFT_ITEM', payload: item });
    }, [dispatch]);

    const setSelectedRightItem = useCallback((item: SampleLocation | null) => {
        dispatch({ type: 'SET_SELECTED_RIGHT_ITEM', payload: item });
    }, [dispatch]);

    const toggleSidebar = useCallback(() => {
        dispatch({ type: 'TOGGLE_SIDEBAR' });
    }, [dispatch]);

    const toggleRightSidebar = useCallback((isCollapsed?: boolean) => {
        dispatch({ type: 'TOGGLE_RIGHT_SIDEBAR', payload: isCollapsed });
    }, [dispatch]);

    const setShowAccountActions = useCallback((show: boolean) => {
        dispatch({ type: 'SET_SHOW_ACCOUNT_ACTIONS', payload: show });
    }, [dispatch]);

    const setErrorMessage = useCallback((message: string) => {
        dispatch({ type: 'SET_ERROR_MESSAGE', payload: message });
    }, [dispatch]);

    const setFilters = useCallback((filters: UIState['filters']) => {
        dispatch({ type: 'SET_FILTERS', payload: filters });
    }, [dispatch]);

    const setModalState = useCallback((modalState: ModalState) => {
        dispatch({ type: 'SET_MODAL_STATE', payload: modalState });
    }, [dispatch]);

    const setContextMenuState = useCallback((contextMenu: ContextMenuState) => {
        dispatch({ type: 'SET_CONTEXT_MENU_STATE', payload: contextMenu });
    }, [dispatch]);

    const closeContextMenu = useCallback(() => {
        setContextMenuState({
            isVisible: false,
            x: 0,
            y: 0,
            itemId: null
        });
    }, [setContextMenuState]);

    return {
        // UI State
        selectedLeftItem: state.ui.selectedLeftItem,
        selectedRightItem: state.ui.selectedRightItem,
        isSidebarCollapsed: state.ui.isSidebarCollapsed,
        isRightSidebarCollapsed: state.ui.isRightSidebarCollapsed,
        showAccountActions: state.ui.showAccountActions,
        errorMessage: state.ui.errorMessage,
        filters: state.ui.filters,
        modal: state.ui.modal,
        contextMenu: state.ui.contextMenu,

        // Actions
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