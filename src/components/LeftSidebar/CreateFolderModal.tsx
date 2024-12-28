// src/components/LeftSidebar/modals/CreateFolderModal.tsx

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

interface CreateFolderModalProps {
    open: boolean;
    onClose: () => void;
    organization: Organization | null;
    addFileNode: (node: any) => Promise<void>;
    setErrorMessage: (msg: string) => void;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
                                                                 open,
                                                                 onClose,
                                                                 organization,
                                                                 addFileNode,
                                                                 setErrorMessage,
                                                             }) => {
    const [folderName, setFolderName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Reset fields when open changes
    useEffect(() => {
        if (!open) {
            setFolderName('');
            setIsProcessing(false);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!folderName.trim()) {
            setErrorMessage('Folder name is required.');
            return;
        }

        if (!organization?.id) {
            setErrorMessage('No organization info found.');
            return;
        }

        try {
            setIsProcessing(true);

            const newFolder = {
                id: uuidv4(),
                org_id: organization.id,
                name: folderName,
                type: 'folder' as const,
                parent_id: null,
                droppable: 1,
                children: [],
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            await addFileNode(newFolder);
            setErrorMessage('');
            onClose();
        } catch (error: any) {
            console.error('Error creating folder:', error);
            setErrorMessage(error.message || 'An unexpected error occurred.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogContent dividers>
                    <Box marginBottom={2}>
                        <TextField
                            label="Folder Name"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
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

export default CreateFolderModal;
