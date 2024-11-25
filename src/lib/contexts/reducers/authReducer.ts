// src/lib/contexts/reducers/authReducer.ts

import { AuthState, AppAction } from '../../types';

const initialAuthState: AuthState = {
    user: null,
    userProfile: null,
    organization: null,
    loading: true,
    error: null
};

export function authReducer(state: AuthState = initialAuthState, action: AppAction): AuthState {
    switch (action.type) {
        case 'SET_USER':
            return {
                ...state,
                user: action.payload
            };

        case 'SET_USER_PROFILE':
            return {
                ...state,
                userProfile: action.payload
            };

        case 'SET_ORGANIZATION':
            return {
                ...state,
                organization: action.payload
            };

        case 'SET_AUTH_LOADING':
            return {
                ...state,
                loading: action.payload
            };

        case 'SET_AUTH_ERROR':
            return {
                ...state,
                error: action.payload
            };

        default:
            return state;
    }
}