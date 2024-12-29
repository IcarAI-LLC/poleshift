// src/components/LeftSidebar/modals/CreateContainerModal.tsx

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
} from '@mui/material';
import { v4 as uuidv4 } from 'uuid';

import type { Organization } from '../../lib/types';

interface CreateContainerModalProps {
    open: boolean;
    onClose: () => void;
    organization: Organization | null;
    addFileNode: (node: any) => Promise<void>;
    setErrorMessage: (msg: string) => void;
}

const CreateContainerModal: React.FC<CreateContainerModalProps> = ({
                                                                 open,
                                                                 onClose,
                                                                 organization,
                                                                 addFileNode,
                                                                 setErrorMessage,
                                                             }) => {
    const [containerName, setContainerName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Reset fields when open changes
    useEffect(() => {
        if (!open) {
            setContainerName('');
            setIsProcessing(false);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!containerName.trim()) {
            setErrorMessage('Container name is required.');
            return;
        }

        if (!organization?.id) {
            setErrorMessage('No organization info found.');
            return;
        }

        try {
            setIsProcessing(true);

            const newContainer = {
                id: uuidv4(),
                org_id: organization.id,
                name: containerName,
                type: 'container' as const,
                parent_id: null,
                droppable: 0,
                children: [],
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            await addFileNode(newContainer);
            setErrorMessage('');
            onClose();
        } catch (error: any) {
            console.error('Error creating container:', error);
            setErrorMessage(error.message || 'An unexpected error occurred.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>Create New Query Container</DialogTitle>
                <DialogContent dividers>
                    <Box marginBottom={2}>
                        <TextField
                            label="Container Name"
                            value={containerName}
                            onChange={(e) => setContainerName(e.target.value)}
                            fullWidth
                            required
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
        </Dialog>
    );
};

export default CreateContainerModal;
