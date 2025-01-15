// src/renderer/components/DropBoxes/ModalInputs/NutrientAmmoniaInput.tsx
import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    IconButton,
    Box,
    CircularProgress,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface NutrientAmmoniaInputProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (ammoniaValue: number) => void;
    isProcessing?: boolean;
}

const NutrientAmmoniaInput: React.FC<NutrientAmmoniaInputProps> = ({
                                                                       open,
                                                                       onClose,
                                                                       onSubmit,
                                                                       isProcessing = false,
                                                                   }) => {
    const [ammoniaValue, setAmmoniaValue] = useState<string>('');

    const handleSubmit = () => {
        // Convert to float
        const numericVal = parseFloat(ammoniaValue);
        // Simple validation
        if (isNaN(numericVal) || numericVal <= 0) {
            alert('Please enter a valid positive number for ammonia');
            return;
        }
        onSubmit(numericVal); // Let parent handle the actual saving
    };

    const handleClose = () => {
        // If you want to clear values each time modal closes:
        setAmmoniaValue('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <Box sx={{ display: 'flex', alignItems: 'center', padding: 2 }}>
                <DialogTitle sx={{ flexGrow: 1, padding: 0 }}>Nutrient Ammonia</DialogTitle>
                <IconButton onClick={handleClose} disabled={isProcessing} size="small">
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent dividers>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Please enter your measured ammonia concentration in mg/L:
                </Typography>

                <TextField
                    fullWidth
                    type="number"
                    label="Ammonia (mg/L)"
                    variant="outlined"
                    value={ammoniaValue}
                    onChange={(e) => setAmmoniaValue(e.target.value)}
                    disabled={isProcessing}
                    required
                />
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} color="inherit" disabled={isProcessing}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} variant="contained" disabled={isProcessing}>
                    {isProcessing ? <CircularProgress size={22} color="inherit" /> : 'Submit'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NutrientAmmoniaInput;
