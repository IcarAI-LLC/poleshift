import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Autocomplete,
} from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';

// Import these from MUI X date pickers
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';

import type {Organizations, SampleGroupMetadata, SampleLocations} from '@/lib/types';
import { useAuthStore } from "@/lib/stores/authStore.ts";

interface CreateSampleGroupModalProps {
    open: boolean;
    onClose: () => void;
    organization: Organizations | null; // or undefined
    sampleGroups: Record<string, SampleGroupMetadata>;
    locations: SampleLocations[];
    createSampleGroup: (data: any, fileNode: any) => Promise<void>;
    setErrorMessage: (msg: string) => void;
}

const CreateSampleGroupModal: React.FC<CreateSampleGroupModalProps> = ({
                                                                           open,
                                                                           onClose,
                                                                           organization,
                                                                           sampleGroups,
                                                                           locations,
                                                                           createSampleGroup,
                                                                           setErrorMessage,
                                                                       }) => {
    // Form state
    const [collectionDate, setCollectionDate] = useState('');
    // Store time in "HH:mm:ss" format
    const [collectionTime, setCollectionTime] = useState('');
    const [locCharId, setLocCharId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { userId } = useAuthStore.getState();

    // Reset fields each time modal is closed
    useEffect(() => {
        if (!open) {
            setCollectionDate('');
            setCollectionTime('');
            setLocCharId('');
            setIsProcessing(false);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!organization?.id || !organization.org_short_id) {
            setErrorMessage('No organization info found.');
            return;
        }

        if (!collectionDate || !locCharId) {
            setErrorMessage('Collection date and location are required.');
            return;
        }

        try {
            setIsProcessing(true);

            const formattedDate = new Date(collectionDate).toISOString().split('T')[0];
            const baseName = `${formattedDate}-${locCharId}`;

            // Figure out the next sample number
            const existingNumbers = Object.values(sampleGroups)
                .filter((group) => group.org_id === organization.id)
                .map((group) => {
                    const regex = new RegExp(
                        `^${baseName}-(\\d{2})-${organization.org_short_id}$`
                    );
                    const match = group.human_readable_sample_id.match(regex);
                    return match ? parseInt(match[1], 10) : null;
                })
                .filter((num): num is number => num !== null);

            let nextNumber = 0;
            while (existingNumbers.includes(nextNumber)) {
                nextNumber += 1;
            }

            const formattedNumber = String(nextNumber).padStart(2, '0');
            const sampleGroupName = `${baseName}-${formattedNumber}-${organization.org_short_id}`;

            // Find the location by its char_id
            const location = locations.find((loc) => loc.char_id === locCharId);
            if (!location) {
                throw new Error(`Location with char_id ${locCharId} not found.`);
            }

            const rawDataFolderPath = `${organization.org_short_id}/${sampleGroupName}/`;
            const id: string = uuidv4();

            // The new file node
            const newNode = {
                id,
                org_id: organization.id,
                name: sampleGroupName,
                type: 'sampleGroup' as const,
                parent_id: null,
                droppable: 0,
                children: [],
                version: 1,
                sample_group_id: id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // The sample group record
            const sampleGroupData = {
                id,
                human_readable_sample_id: sampleGroupName,
                loc_id: location.id,
                storage_folder: rawDataFolderPath,
                collection_date: formattedDate,
                // Combine date and time into an ISO string if there's a time
                // e.g. "2024-01-01T13:05:30Z"
                collection_datetime_utc: collectionTime
                    ? `${collectionDate}T${collectionTime}Z`
                    : undefined,
                user_id: userId,
                org_id: organization.id,
                latitude_recorded: null,
                longitude_recorded: null,
                notes: null,
                created_at: new Date().toISOString(),
                updated_at: DateTime.now().toISO(),
                excluded: 0,
                penguin_count: null,
                penguin_present: 0,
            };

            await createSampleGroup(sampleGroupData, newNode);
            setErrorMessage('');
            onClose();
        } catch (error: any) {
            console.error('Error creating sample group:', error);
            setErrorMessage(error.message || 'An unexpected error occurred.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            {/* Wrap pickers in a LocalizationProvider (Luxon in this example). */}
            <LocalizationProvider dateAdapter={AdapterLuxon}>
                <form onSubmit={handleSubmit}>
                    <DialogTitle>Create New Sampling Event</DialogTitle>
                    <DialogContent dividers>
                        {/* Collection Date */}
                        <Box marginBottom={2}>
                            <TextField
                                label="Collection Date"
                                type="date"
                                value={collectionDate}
                                onChange={(e) => setCollectionDate(e.target.value)}
                                fullWidth
                                required
                                InputLabelProps={{ shrink: true }}
                            />
                        </Box>

                        {/* 24-hour TimePicker with seconds */}
                        <Box marginBottom={2}>
                            <TimePicker
                                label="Collection Time (UTC)"
                                ampm={false}
                                views={['hours', 'minutes', 'seconds']}
                                value={
                                    collectionTime
                                        ? DateTime.fromFormat(collectionTime, 'HH:mm:ss')
                                        : null
                                }
                                onChange={(newValue) => {
                                    if (newValue) {
                                        setCollectionTime(newValue.toFormat('HH:mm:ss'));
                                    } else {
                                        setCollectionTime('');
                                    }
                                }}
                                // Instead of `renderInput`, use `slotProps.textField`.
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        required: false,   // make true if needed
                                        InputLabelProps: { shrink: true },
                                    },
                                }}
                            />
                        </Box>

                        {/* Location Autocomplete */}
                        <Box marginBottom={2}>
                            <Autocomplete
                                value={
                                    locCharId
                                        ? locations.find((loc) => loc.char_id === locCharId) || null
                                        : null
                                }
                                onChange={(_event, newValue) => {
                                    setLocCharId(newValue?.char_id || '');
                                }}
                                options={locations}
                                getOptionLabel={(option) =>
                                    `${option.label} (${option.char_id})`
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Location"
                                        required
                                    />
                                )}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" disabled={isProcessing}>
                            {isProcessing ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogActions>
                </form>
            </LocalizationProvider>
        </Dialog>
    );
};

export default CreateSampleGroupModal;
