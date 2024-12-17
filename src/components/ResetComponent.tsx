// ResetComponent.tsx
import React, {useState} from 'react';
import {IconButton, Tooltip, CircularProgress, Snackbar, Alert} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface ResetComponentProps {
    onReset: () => Promise<void>; // Function to execute the reset commands
}

const ResetComponent: React.FC<ResetComponentProps> = ({onReset}) => {
    const [isResetting, setIsResetting] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    const handleReset = async () => {
        setIsResetting(true);
        try {
            // Execute the series of reset commands
            await onReset();

            // Notify the user upon successful completion
            setSnackbarMessage('Reset completed successfully.');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
        } catch (error) {
            console.error('Reset failed:', error);
            setSnackbarMessage('Reset failed. Please try again.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setIsResetting(false);
        }
    };

    const handleCloseSnackbar = (
        _event?: React.SyntheticEvent | Event,
        reason?: string
    ) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenSnackbar(false);
    };

    return (
        <>
            <Tooltip title="Reset Application">
        <span>
          {/* Span is used to handle disabled state tooltip */}
            <IconButton
                onClick={handleReset}
                disabled={isResetting}
                color={isResetting ? 'default' : 'primary'}
                aria-label="reset application"
            >
            {isResetting ? <CircularProgress size={24}/> : <RefreshIcon/>}
          </IconButton>
        </span>
            </Tooltip>

            <Snackbar
                open={openSnackbar}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{width: '100%'}}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </>
    );
};

export default ResetComponent;
