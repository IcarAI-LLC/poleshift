// src/lib/hooks/useUI.ts

import { useCallback } from 'react';
import { useAppState } from '../contexts/AppContext';
import { TreeItem, ResearchLocation } from '../types';

export function useUI() {
    const { state, dispatch } = useAppState();
    const { ui } = state;

    const setSelectedLeftItem = useCallback((item: TreeItem | null) => {
        dispatch({ type: 'SET_SELECTED_LEFT_ITEM', payload: item });
    }, [dispatch]);

    const setSelectedRightItem = useCallback((item: ResearchLocation | null) => {
        dispatch({ type: 'SET_SELECTED_RIGHT_ITEM', payload: item });
    }, [dispatch]);

    const toggleSidebar = useCallback((value?: boolean) => {
        dispatch({ type: 'TOGGLE_SIDEBAR', payload: value });
    }, [dispatch]);

    const toggleRightSidebar = useCallback((value?: boolean) => {
        dispatch({ type: 'TOGGLE_RIGHT_SIDEBAR', payload: value });
    }, [dispatch]);

    const setShowAccountActions = useCallback((show: boolean) => {
        dispatch({ type: 'SET_SHOW_ACCOUNT_ACTIONS', payload: show });
    }, [dispatch]);

    const setErrorMessage = useCallback((message: string) => {
        dispatch({ type: 'SET_ERROR_MESSAGE', payload: message });
    }, [dispatch]);

    const setFilters = useCallback((filters: typeof ui.filters) => {
        dispatch({ type: 'SET_FILTERS', payload: filters });
    }, [dispatch]);

    const setModalState = useCallback((modalState: typeof ui.modal) => {
        dispatch({ type: 'SET_MODAL_STATE', payload: modalState });
    }, [dispatch]);

    return {
        selectedLeftItem: ui.selectedLeftItem,
        selectedRightItem: ui.selectedRightItem,
        isSidebarCollapsed: ui.isSidebarCollapsed,
        isRightSidebarCollapsed: ui.isRightSidebarCollapsed,
        showAccountActions: ui.showAccountActions,
        errorMessage: ui.errorMessage,
        filters: ui.filters,
        modal: ui.modal,
        setSelectedLeftItem,
        setSelectedRightItem,
        toggleSidebar,
        toggleRightSidebar,
        setShowAccountActions,
        setErrorMessage,
        setFilters,
        setModalState
    };
}