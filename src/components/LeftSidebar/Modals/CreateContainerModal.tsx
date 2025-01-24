import { useEffect, useState } from 'react';
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
import { FileNodeType } from '@/lib/powersync/DrizzleSchema.ts';

interface CreateContainerModalProps {
  open: boolean;
  onClose: () => void;
  organization: Organizations | null;
  addFileNode: (node: FileNodes) => Promise<void>;
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

  // Reset fields whenever the dialog closes
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
        name: containerName.trim(),
        type: FileNodeType.Container,
        parent_id: null,
        sample_group_id: null,
        droppable: 0,
        children: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await addFileNode(newContainer);
      setErrorMessage('');
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMessage('Failed to create container.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Query Container</DialogTitle>
          </DialogHeader>

          <div className='space-y-2 py-2'>
            <Label htmlFor='container-name'>Container Name</Label>
            <Input
              id='container-name'
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
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

export default CreateContainerModal;
