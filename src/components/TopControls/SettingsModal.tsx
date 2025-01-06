// src/components/SettingsModal.tsx

import React, {useState, useCallback, useEffect} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    IconButton,
    useTheme,
    Box,
    TextField,
    CircularProgress,
    Alert,
    Autocomplete,
    Tooltip,
    FormControlLabel,
    Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GenomeIcon from '../../assets/icons/genome.svg';
import PublicIcon from '@mui/icons-material/Public';
import { useSettings } from '@/lib/hooks/useSettings';
import { useAuth } from '@/lib/hooks';
import { UserSettings } from '@/lib/types';
import { TaxonomicRank } from '@/lib/powersync/DrizzleSchema';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const theme = useTheme();

    // Pull the single 'userSettings' from our new hook:
    const {
        userSettings,     // The existing row for the current user (or null if none)
        loading,
        error,
        addUserSetting,
        updateUserSetting,
    } = useSettings();

    const { user } = useAuth();

    // Local state for the form
    const [newSetting, setNewSetting] = useState<Partial<UserSettings>>({});

    /**
     * Whenever `userSettings` (the stored data) or the user itself changes,
     * update local form state.
     */
    useEffect(() => {
        if (userSettings) {
            // Existing row in DB; populate the form with those values
            setNewSetting(userSettings);
        } else if (user) {
            // No row yet for this user; default to a new object with the user's ID
            setNewSetting({ id: user.id });
        }
    }, [userSettings, user]);

    const handleSave = useCallback(async () => {
        try {
            const settingToSave = {
                ...newSetting,
                // Fallback to user.id just in case
                id: newSetting.id || user?.id,
            };

            if (userSettings) {
                // Row exists => update it
                await updateUserSetting(settingToSave);
            } else {
                // Otherwise => create a new row
                await addUserSetting(settingToSave as UserSettings);
            }

            onClose();
        } catch (err) {
            console.error('Failed to save setting:', err);
        }
    }, [userSettings, newSetting, user, updateUserSetting, addUserSetting, onClose]);

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: theme.palette.background.paper,
                    backgroundImage: 'none',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                },
            }}
        >
            {/* Header */}
            <DialogTitle
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: theme.spacing(2),
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }}
            >
                <Typography variant="h6">
                    {userSettings ? 'Edit Settings' : 'Create Your Settings'}
                </Typography>
                <IconButton
                    onClick={onClose}
                    aria-label="Close"
                    size="small"
                    sx={{
                        color: theme.palette.text.primary,
                        '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ padding: theme.spacing(2) }}>
                {/* Loading / Error handling */}
                {loading && <CircularProgress />}
                {error && <Alert severity="error">{String(error)}</Alert>}

                <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                        {userSettings ? 'User Settings' : 'Create New Setting'}
                    </Typography>

                    {/* ============ PowerSync Server Section ============ */}
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            PowerSync
                        </Typography>

                        <Tooltip title="Enter the full URL of your PowerSync server.">
                            <TextField
                                label="PowerSync Server URL"
                                placeholder="https://icarai.net"
                                value={newSetting.powersync_server || ''}
                                onChange={(e) =>
                                    setNewSetting((prev) => ({
                                        ...prev,
                                        powersync_server: e.target.value,
                                    }))
                                }
                                fullWidth
                                sx={{ mb: 2 }}
                            />
                        </Tooltip>
                    </Box>

                    {/* ============ Taxonomic Starburst Section ============ */}
                    <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <img
                                src={GenomeIcon}
                                alt="Genome Icon"
                                style={{ width: 24, height: 24 }}
                            />
                            <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 'bold' }}>
                                Taxonomic Starburst
                            </Typography>
                        </Box>

                        {/* Max Rank */}
                        <Tooltip title="Max depth to query for taxonomic data in the starburst">
                            <Autocomplete
                                options={Object.values(TaxonomicRank)}
                                value={newSetting.taxonomic_starburst_max_rank || null}
                                onChange={(_, newValue) => {
                                    setNewSetting((prev) => ({
                                        ...prev,
                                        taxonomic_starburst_max_rank: newValue || undefined,
                                    }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Max Rank"
                                        fullWidth
                                        sx={{ mb: 2 }}
                                    />
                                )}
                            />
                        </Tooltip>

                        {/* Min Rank */}
                        <Tooltip title="Experimental setting, use at your own risk">
                            <Autocomplete
                                options={Object.values(TaxonomicRank)}
                                value={newSetting.taxonomic_starburst_min_rank || null}
                                onChange={(_, newValue) => {
                                    setNewSetting((prev) => ({
                                        ...prev,
                                        taxonomic_starburst_min_rank: newValue || undefined,
                                    }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Min Rank"
                                        fullWidth
                                        sx={{ mb: 2 }}
                                    />
                                )}
                            />
                        </Tooltip>
                    </Box>

                    {/* ============ Globe Section ============ */}
                    <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <PublicIcon sx={{ mr: 1 }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                Globe
                            </Typography>
                        </Box>

                        {/* Poles */}
                        <Tooltip title="Turn off for globe points, on for globe poles">
                            <FormControlLabel
                                label="Poles"
                                sx={{ display: 'block', mb: 2 }}
                                control={
                                    <Switch
                                        checked={Boolean(newSetting.globe_datapoint_poles)}
                                        onChange={(e) =>
                                            setNewSetting((prev) => ({
                                                ...prev,
                                                globe_datapoint_poles: e.target.checked ? 1 : 0,
                                            }))
                                        }
                                    />
                                }
                            />
                        </Tooltip>

                        {/* Color */}
                        <Tooltip title="Point color in RGBA format">
                            <TextField
                                label="Color (RGBA)"
                                placeholder="rgba(255, 0, 0, 0.5)"
                                value={newSetting.globe_datapoint_color || ''}
                                onChange={(e) =>
                                    setNewSetting((prev) => ({
                                        ...prev,
                                        globe_datapoint_color: e.target.value,
                                    }))
                                }
                                fullWidth
                                sx={{ mb: 2 }}
                            />
                        </Tooltip>

                        {/* Diameter */}
                        <Tooltip title="Globe point size">
                            <TextField
                                label="Diameter"
                                type="number"
                                value={newSetting.globe_datapoint_diameter || ''}
                                onChange={(e) =>
                                    setNewSetting((prev) => ({
                                        ...prev,
                                        globe_datapoint_diameter: e.target.value,
                                    }))
                                }
                                fullWidth
                                sx={{ mb: 2 }}
                            />
                        </Tooltip>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ padding: theme.spacing(2) }}>
                <Button onClick={onClose} color="primary">
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    color="primary"
                    variant="contained"
                    disabled={loading}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SettingsModal;
