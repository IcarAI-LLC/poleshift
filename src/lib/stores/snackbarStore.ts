// src/store/snackbarStore.ts

import { create } from 'zustand';
import { AlertColor } from '@mui/material';

interface SnackbarState {
    open: boolean;
    message: string;
    severity: AlertColor;
    showSnackbar: (message: string, severity?: AlertColor) => void;
    hideSnackbar: () => void;
}

export const useSnackbarStore = create<SnackbarState>((set: (arg0: { open: boolean; message?: string; severity?: AlertColor; }) => any) => ({
    open: false,
    message: '',
    severity: 'info',
    showSnackbar: (message: string, severity: AlertColor = 'info') =>
        set({ open: true, message, severity }),
    hideSnackbar: () => set({ open: false }),
}));
