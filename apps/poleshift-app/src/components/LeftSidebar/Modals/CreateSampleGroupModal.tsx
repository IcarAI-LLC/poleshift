import { useEffect, useState, useMemo, FormEvent, FC } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// shadcn/ui components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from '@/components/ui/command';

import type {
  FileNodes,
  Organizations,
  SampleGroupMetadata,
  SampleLocations,
} from 'src/types';
import { useAuthStore } from '@/stores/authStore';
import { TimePicker } from '@/components/ui/time-picker.tsx';

interface CreateSampleGroupModalProps {
  open: boolean;
  onClose: () => void;
  organization: Organizations | null;
  sampleGroups: Record<string, SampleGroupMetadata>;
  locations: SampleLocations[];
  createSampleGroup: (
    data: SampleGroupMetadata,
    fileNode: FileNodes
  ) => Promise<void>;
  setErrorMessage: (msg: string) => void;
}

const CreateSampleGroupModal: FC<CreateSampleGroupModalProps> = ({
  open,
  onClose,
  organization,
  sampleGroups,
  locations,
  createSampleGroup,
  setErrorMessage,
}) => {
  // Store the date as a Date object or null
  const [collectionDate, setCollectionDate] = useState<Date | null>(null);
  // Store time in "HH:mm:ss" format
  const [collectionTime, setCollectionTime] = useState('');
  const [locCharId, setLocCharId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { userId } = useAuthStore.getState();

  // Reset fields each time the modal is closed
  useEffect(() => {
    if (!open) {
      setCollectionDate(null);
      setCollectionTime('');
      setLocCharId('');
      setSearchTerm('');
      setIsProcessing(false);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('Creating sample group.');

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

      // Convert the selected Date to YYYY-MM-DD
      const formattedDate = DateTime.fromJSDate(collectionDate).toISODate(); // e.g. "2025-01-14"

      // Build the base name (YYYY-MM-DD-locCharId)
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

      // Generate a UUID for the new sample group
      const id: string = uuidv4();

      // The new file node
      const newNode: FileNodes = {
        id,
        org_id: organization.id,
        name: sampleGroupName,
        type: 'sampleGroup',
        parent_id: null,
        droppable: 0,
        version: 1,
        sample_group_id: id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Combine date + time into UTC if time is set
      const collectionDateTimeUTC = collectionTime
        ? `${DateTime.fromJSDate(collectionDate).toISODate()}T${collectionTime}Z`
        : null;

      if (!formattedDate) {
        setErrorMessage('Sample date is required');
      }

      // The sample group record
      const sampleGroupData: SampleGroupMetadata = {
        id,
        human_readable_sample_id: sampleGroupName,
        loc_id: location.id,
        collection_date: formattedDate || '',
        collection_datetime_utc: collectionDateTimeUTC,
        user_id: userId,
        org_id: organization.id,
        latitude_recorded: null,
        longitude_recorded: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: DateTime.now().toISO(),
        excluded: false,
        penguin_count: null,
        penguin_present: 0,
        proximity_category: null,
      };

      await createSampleGroup(sampleGroupData, newNode);
      setErrorMessage('');
      onClose();
    } catch (err) {
      console.error(err);
      // @ts-expect-error: Let’s just cast it
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter location list based on searchTerm
  const filteredLocations = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return locations.filter(
      (loc) =>
        loc.label.toLowerCase().includes(lower) ||
        loc.char_id.toLowerCase().includes(lower)
    );
  }, [locations, searchTerm]);

  // Manage whether the location popover is open
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Sampling Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Collection Date */}
          <div className='grid w-full max-w-sm items-center gap-1.5 mb-4'>
            <Label htmlFor='collection-date'>Collection Date</Label>
            <ReactDatePicker
              id='collection-date'
              selected={collectionDate}
              onChange={(date) => setCollectionDate(date)}
              placeholderText='Select date...'
              className='w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none'
            />
          </div>

          {/* Collection Time (UTC) */}
          <div className='grid w-full max-w-sm items-center gap-1.5 mb-4'>
            <Label htmlFor='collection-time'>Collection Time (UTC)</Label>
            <TimePicker
              value={collectionTime}
              onChange={(e) => setCollectionTime(e)}
            />
          </div>

          {/* Location Selection (Popover + Command) */}
          <div className='grid w-full max-w-sm items-center gap-1.5 mb-4'>
            <Label htmlFor='location'>Location</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-full justify-between'>
                  {locCharId ? `${locCharId} selected` : 'Select a location...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='bottom'
                align='start'
                sideOffset={8}
                updatePositionStrategy={'optimized'}
                avoidCollisions={false}
                className='p-0 w-[250px]'
              >
                <Command>
                  <CommandInput
                    placeholder='Search location...'
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup>
                      {filteredLocations.map((loc) => (
                        <CommandItem
                          key={loc.char_id}
                          onSelect={() => {
                            setLocCharId(loc.char_id);
                            setSearchTerm(`${loc.label} (${loc.char_id})`);
                            setPopoverOpen(false);
                          }}
                        >
                          {loc.label} ({loc.char_id})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Footer Buttons */}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isProcessing}>
              {isProcessing ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSampleGroupModal;
