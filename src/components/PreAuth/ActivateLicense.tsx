// src/components/PostAuth/ActivateLicense.tsx

import React, { useState } from 'react';
import { Box, TextField, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '../../lib/hooks';

const ActivateLicense: React.FC = () => {
    const { activateLicense, loading, error } = useAuth();
    const [licenseKey, setLicenseKey] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLocalError(null);
        setMessage(null);

        if (!licenseKey) {
            setLocalError('Please enter a license key');
            return;
        }

        try {
            await activateLicense(licenseKey);
            setMessage('License activated successfully! Loading your profile...');
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'License activation failed');
        }
    };

    const displayError = localError || error;

    return (
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            minHeight="100vh"
            bgcolor="background.default"
            color="text.primary"
            p={2}
        >
            <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{
                    width: '100%',
                    maxWidth: 400,
                    p: 4,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    boxShadow: 3,
                }}
            >
                <Typography variant="h5" component="h1" gutterBottom align="center">
                    Activate Your License
                </Typography>

                {displayError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {displayError}
                    </Alert>
                )}

                {message && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {message}
                    </Alert>
                )}

                <TextField
                    label="License Key"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    required
                    disabled={loading || !!message}
                    inputProps={{
                        'aria-label': 'License Key',
                    }}
                />

                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{ mt: 2, mb: 1 }}
                    disabled={loading || !!message}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                    {loading ? 'Activating...' : 'Activate'}
                </Button>
            </Box>
        </Box>
    );
};

export default ActivateLicense;
