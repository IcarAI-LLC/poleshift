import { FC, FormEvent, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { FileNodes, Organizations } from 'src/types';

// ShadCN/UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  organization: Organizations | null;
  addFileNode: (node: FileNodes) => Promise<void>;
  setErrorMessage: (msg: string) => void;
}

const CreateFolderModal: FC<CreateFolderModalProps> = ({
  open,
  onClose,
  organization,
  addFileNode,
  setErrorMessage,
}) => {
  const [folderName, setFolderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset fields whenever the dialog closes
  useEffect(() => {
    if (!open) {
      setFolderName('');
      setIsProcessing(false);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!folderName.trim()) {
      setErrorMessage('Folder name is required.');
      return;
    }

    if (!organization?.id) {
      setErrorMessage('No organization info found.');
      return;
    }
    console.log('Submitting!');
    try {
      setIsProcessing(true);

      const newFolder = {
        id: uuidv4(),
        org_id: organization.id,
        sample_group_id: null,
        name: folderName.trim(),
        type: 'folder' as const,
        parent_id: null,
        droppable: 1,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await addFileNode(newFolder);
      setErrorMessage('');
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>

          <div className='space-y-2 py-2'>
            <Label htmlFor='folder-name'>Folder Name</Label>
            <Input
              id='folder-name'
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              type='button'
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isProcessing}
              onClick={handleSubmit}
            >
              {isProcessing ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
};

export default CreateFolderModal;
