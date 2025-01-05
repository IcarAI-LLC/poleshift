// src/components/SettingsModal.tsx

import React, { useState, useCallback, useEffect } from 'react';
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
import { useSettings } from '@/lib/hooks/useSettings.ts';
import { useAuth } from '@/lib/hooks';
import { UserSettings } from '@/lib/types';
import {TaxonomicRank} from "@/lib/powersync/DrizzleSchema.ts";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const theme = useTheme();
    const {
        userSettingsArray, // array of UserSetting
        loading,
        error,
        addUserSetting,
        updateUserSetting,
    } = useSettings();
    const { user } = useAuth();

    // State for the user's (new or existing) settings
    const [newSetting, setNewSetting] = useState<Partial<UserSettings>>({
        user_id: user?.id, // Pre-fill with user ID
    });

    /**
     * Whenever userSettingsArray changes or a user logs in,
     * find this user’s existing settings (if any) and populate the form.
     *
     * For simplicity, we assume there is at most one settings row per user.
     */
    useEffect(() => {
        if (user && userSettingsArray.length > 0) {
            const existingSetting = userSettingsArray.find(
                (setting) => setting.user_id === user.id
            );
            if (existingSetting) {
                setNewSetting(existingSetting);
            } else {
                // No existing setting found for this user
                setNewSetting({ user_id: user.id });
            }
        }
    }, [user, userSettingsArray]);

    // Handler to create or update a user setting
    const handleSave = useCallback(async () => {
        try {
            if (newSetting.id !== undefined) {
                // If there's an ID, it's an existing record => update
                await updateUserSetting(newSetting.id, newSetting);
            } else {
                // Otherwise, insert new setting
                await addUserSetting(newSetting as UserSettings);
            }
            onClose();
        } catch (err) {
            console.error('Failed to save setting:', err);
        }
    }, [newSetting, addUserSetting, updateUserSetting, onClose]);

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
                <Typography variant="h6">Settings</Typography>
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
                    <Typography variant="subtitle1" gutterBottom sx={{ fontweight: 'bold'}}>
                        {newSetting.id ? 'User Settings' : 'Create Your Setting'}
                    </Typography>

                    {/* ============ Taxonomic Starburst Section ============ */}
                    <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <img
                                src={GenomeIcon}
                                alt="Genome Icon"
                                style={{width: 24, height: 24}}
                            />
                            <Typography variant="subtitle2" sx={{ml: 1, fontWeight: 'bold'}}>
                                Taxonomic Starburst
                            </Typography>
                        </Box>

                        {/* Max Rank */}
                        <Tooltip title="Tooltip text for Max Rank">
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
                        <Tooltip title="Tooltip text for Min Rank">
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
                        <Tooltip title="Tooltip text for Poles">
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
                        <Tooltip title="Tooltip text for Color (RGBA)">
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
                        <Tooltip title="Tooltip text for Diameter">
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
