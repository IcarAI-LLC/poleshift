// src/components/MoveModal.tsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useData, useUI } from '../../lib/hooks';
import type { FileNode } from '../../lib/types';

const MoveModal: React.FC = () => {
    const { fileTree, moveNode } = useData();
    const { moveModalItemId, setHideMoveModal } = useUI();
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    console.debug('MoveModal', moveModalItemId, selectedFolderId);
    if (!moveModalItemId) return null;

    // Filter folders only (type === 'folder')
    const allFolders = (nodes: FileNode[]): FileNode[] => {
        let result: FileNode[] = [];
        for (const node of nodes) {
            if (node.type === 'folder') result.push(node);
            if (node.children && node.children.length > 0) {
                result = result.concat(allFolders(node.children));
            }
        }
        return result;
    };

    const folders = allFolders(fileTree);

    const handleMove = async () => {
        await moveNode(moveModalItemId, selectedFolderId || null);
        setHideMoveModal();
    };

    return (
        <Dialog open={Boolean(moveModalItemId)} onClose={setHideMoveModal}>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogContent>
                <FormControl fullWidth>
                    <InputLabel id="folder-select-label">Select Folder</InputLabel>
                    <Select
                        labelId="folder-select-label"
                        label="Select Folder"
                        value={selectedFolderId}
                        onChange={(e) => setSelectedFolderId(e.target.value)}
                    >
                        <MenuItem value="">(No Parent)</MenuItem>
                        {folders.map((folder) => (
                            <MenuItem key={folder.id} value={folder.id}>
                                {folder.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={setHideMoveModal}>Cancel</Button>
                <Button variant="contained" onClick={handleMove} disabled={!folders.length && selectedFolderId === ''}>
                    Move
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MoveModal;
