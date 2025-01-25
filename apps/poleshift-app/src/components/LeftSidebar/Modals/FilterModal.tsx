// src/components/LeftSidebar/Modals/FilterModal.tsx

import React, { useCallback, useMemo, useState } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DateTime } from 'luxon';

import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Label } from '@/components/ui/label.tsx';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover.tsx';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';

import { useUI, useData } from '../../../hooks';
import { Dialog, DialogTitle } from '@/components/ui/dialog.tsx';
import { DialogContent } from '@/components/ui/dialog.tsx';

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
  onReset: () => void;
}

interface FilterState {
  startDate: string | null;
  endDate: string | null;
  selectedLocations: string[];
  showExcluded: boolean;
}

export function FilterModal({
  open,
  onOpenChange,
  onApply,
  onReset,
}: FilterModalProps) {
  const { filters, setFilters } = useUI();
  const { enabledLocations } = useData();

  // Local copy of filters so user changes only apply when they click "Apply"
  const [localFilters, setLocalFilters] = useState<FilterState>({
    startDate: filters.startDate,
    endDate: filters.endDate,
    selectedLocations: filters.selectedLocations,
    showExcluded: filters.showExcluded || false,
  });

  const handleDateChange = useCallback(
    (type: 'startDate' | 'endDate', date: Date | null) => {
      const isoDate = date ? DateTime.fromJSDate(date).toISODate() : null;
      setLocalFilters((prev) => ({ ...prev, [type]: isoDate }));
    },
    []
  );

  const toggleLocation = useCallback((id: string) => {
    setLocalFilters((prev) => {
      const { selectedLocations } = prev;
      const isSelected = selectedLocations.includes(id);
      return {
        ...prev,
        selectedLocations: isSelected
          ? selectedLocations.filter((locId) => locId !== id)
          : [...selectedLocations, id],
      };
    });
  }, []);

  const handleShowExcludedChange = useCallback((checked: boolean) => {
    setLocalFilters((prev) => ({ ...prev, showExcluded: checked }));
  }, []);

  const handleApply = useCallback(() => {
    // 1) Sync local filters to global
    setFilters(localFilters);
    // 2) Let parent know (e.g. to close the modal or do more)
    onApply();
  }, [localFilters, onApply, setFilters]);

  const handleReset = useCallback(() => {
    // Reset to defaults
    const resetFilters = {
      startDate: null,
      endDate: null,
      selectedLocations: [],
      showExcluded: false,
    };
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
    onReset();
  }, [onReset, setFilters]);

  const startDateValue = useMemo(
    () =>
      localFilters.startDate
        ? DateTime.fromISO(localFilters.startDate).toJSDate()
        : null,
    [localFilters.startDate]
  );

  const endDateValue = useMemo(
    () =>
      localFilters.endDate
        ? DateTime.fromISO(localFilters.endDate).toJSDate()
        : null,
    [localFilters.endDate]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Prevent auto-focus when the dialog opens
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle>Filters</DialogTitle>

        {/* Start Date */}
        <div className='mb-4 space-y-1'>
          <Label htmlFor='start-date'>Start Date</Label>
          <ReactDatePicker
            id='start-date'
            selected={startDateValue}
            onChange={(date) => handleDateChange('startDate', date)}
            placeholderText='Select start date...'
            className='w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none'
          />
        </div>

        {/* End Date */}
        <div className='mb-4 space-y-1'>
          <Label htmlFor='end-date'>End Date</Label>
          <ReactDatePicker
            id='end-date'
            selected={endDateValue}
            onChange={(date) => handleDateChange('endDate', date)}
            placeholderText='Select end date...'
            className='w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none'
          />
        </div>

        {/* Locations */}
        <div className='mb-4 space-y-1'>
          <Label>Locations</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className='w-full justify-between'>
                {localFilters.selectedLocations.length > 0
                  ? `Selected (${localFilters.selectedLocations.length})`
                  : 'Search locations...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-72 p-0'>
              <Command>
                <CommandInput placeholder='Search location...' />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    {enabledLocations
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((loc) => {
                        const isChecked =
                          localFilters.selectedLocations.includes(loc.id);
                        return (
                          <CommandItem
                            key={loc.id}
                            onSelect={() => toggleLocation(loc.id)}
                            className='flex cursor-pointer items-center space-x-2'
                          >
                            <Checkbox checked={isChecked} />
                            <span>{loc.label}</span>
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {localFilters.selectedLocations.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-2'>
              {enabledLocations
                .filter((loc) =>
                  localFilters.selectedLocations.includes(loc.id)
                )
                .map((loc) => (
                  <span
                    key={loc.id}
                    className='inline-flex items-center rounded-full'
                  >
                    {loc.label}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Show Excluded Switch */}
        <div className='mb-4 flex items-center space-x-2'>
          <Switch
            checked={localFilters.showExcluded}
            onCheckedChange={handleShowExcludedChange}
            id='show-excluded'
          />
          <Label htmlFor='show-excluded' className='text-sm'>
            Show Excluded
          </Label>
        </div>

        {/* Footer Buttons */}
        <div className='mt-4 flex items-center justify-end space-x-2'>
          <Button variant='outline' onClick={handleReset}>
            Reset
          </Button>
          <Button variant='default' onClick={handleApply}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default React.memo(FilterModal);
