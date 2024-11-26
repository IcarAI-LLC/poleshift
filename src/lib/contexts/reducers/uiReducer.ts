// src/lib/contexts/reducers/uiReducer.ts

import { UIState, AppAction } from '../../types';
// @ts-ignore
import { ResearchLocation } from '../../types'

const initialUIState: UIState = {
    selectedLeftItem: null,
    selectedRightItem: null,
    isSidebarCollapsed: false,
    isRightSidebarCollapsed: true,
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
        modalInputs: {},
        data: undefined,
    },
    contextMenu: {
        isVisible: false,
        x: 0,
        y: 0,
        itemId: null,
    }, // Add this line
};


export function uiReducer(state: UIState = initialUIState, action: AppAction): UIState {
    switch (action.type) {
        case 'SET_SELECTED_LEFT_ITEM':
            return {
                ...state,
                selectedLeftItem: action.payload
            };

        case 'SET_SELECTED_RIGHT_ITEM':
            return {
                ...state,
                selectedRightItem: action.payload
            };

        case 'TOGGLE_SIDEBAR':
            return {
                ...state,
                isSidebarCollapsed: typeof action.payload === 'boolean'
                    ? action.payload
                    : !state.isSidebarCollapsed
            };

        case 'TOGGLE_RIGHT_SIDEBAR':
            return {
                ...state,
                isRightSidebarCollapsed: typeof action.payload === 'boolean'
                    ? action.payload
                    : !state.isRightSidebarCollapsed
            };

        case 'SET_SHOW_ACCOUNT_ACTIONS':
            return {
                ...state,
                showAccountActions: action.payload
            };

        case 'SET_ERROR_MESSAGE':
            return {
                ...state,
                errorMessage: action.payload
            };

        case 'SET_FILTERS':
            return {
                ...state,
                filters: action.payload
            };

        case 'SET_MODAL_STATE':
            return {
                ...state,
                modal: action.payload
            };

        case 'SET_CONTEXT_MENU_STATE':
            return {
                ...state,
                contextMenu: action.payload,
            };
        default:
            return state;
    }
}
