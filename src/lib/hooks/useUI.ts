import { useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { FileNode, SampleLocation, ModalState, ContextMenuState, UIState } from '../types';

/**
 * A custom hook that provides UI state management and actions for UI interactions within the application.
 * It allows for managing the selection of items, toggling sidebars, showing account actions,
 * setting error messages, filters, modal states, and context menu states.
 *
 * @return {object} An object containing the current UI state and methods to manipulate the UI state which includes:
 *   - selectedLeftItem: The currently selected item on the left panel.
 *   - selectedRightItem: The currently selected item on the right panel.
 *   - isSidebarCollapsed: A boolean indicating if the main sidebar is collapsed.
 *   - isRightSidebarCollapsed: A boolean indicating if the right sidebar is collapsed.
 *   - showAccountActions: A boolean to toggle the visibility of account-related actions.
 *   - errorMessage: A string containing the current error message to be displayed.
 *   - filters: An object representing the current set of UI filters.
 *   - modal: An object containing the current state of the modal.
 *   - contextMenu: An object containing the current state of the context menu.
 *   - setSelectedLeftItem(item): A function to set the selected item on the left panel.
 *   - setSelectedRightItem(item): A function to set the selected item on the right panel.
 *   - toggleSidebar(): A function to toggle the main sidebar collapsed state.
 *   - toggleRightSidebar(isCollapsed?): A function to toggle the right sidebar collapsed state with an optional collapse state.
 *   - setShowAccountActions(show): A function to set the visibility of account actions.
 *   - setErrorMessage(message): A function to set the error message.
 *   - setFilters(filters): A function to update the UI filters.
 *   - setModalState(modalState): A function to update the state of the modal.
 *   - setContextMenuState(contextMenu): A function to update the state of the context menu.
 *   - closeContextMenu(): A function to close and reset the context menu state.
 */
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