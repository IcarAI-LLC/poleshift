import { useState, useEffect, useCallback } from 'react';

import { useData, useUI } from '@/hooks';
import { useAuthStore } from '@/stores/authStore.ts';
import { SampleGroupMetadata, PoleshiftPermissions } from '@/types';
import { ProximityCategory } from '@/lib/powersync/DrizzleSchema.ts';
import PenguinIcon from '@/assets/icons/penguin.svg';

import { Card, CardContent } from '@/components/ui/card.tsx';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { Label } from '@/components/ui/label.tsx';
import LocationFields from './LocationFields.tsx';
import { AccordionHeader } from '@radix-ui/react-accordion';
import { TimePicker } from '@/components/ui/time-picker.tsx';

/**
 * Special string value for "no proximity category"
 * rather than an empty string
 */
const NO_PROXIMITY_VALUE = 'NO_PROXIMITY_VALUE';

export default function SampleGroupMetadataComponent() {
  const { locations, updateSampleGroup, sampleGroups, penguinData } = useData();
  const { selectedLeftItem } = useUI();
  const userPermissions = useAuthStore((state) => state.userPermissions);

  const hasModifyPermission = userPermissions?.includes(
    PoleshiftPermissions.ModifySampleGroup
  );

  const [isExpanded, setIsExpanded] = useState(true);
  const [localState, setLocalState] = useState({
    collectionTimeUTC: '',
    notes: '',
    proximityCategory: null as ProximityCategory | null,
    excluded: false,
    penguinCount: null as number | null,
    penguinPresent: 0,
  });

  // Identify the sample group
  const sampleGroup = selectedLeftItem
    ? sampleGroups[selectedLeftItem.id]
    : null;

  // Identify the location and penguin record
  const location = sampleGroup?.loc_id
    ? locations.find((loc) => loc.id === sampleGroup.loc_id)
    : null;

  const penguinRecord = penguinData.find(
    (pd) => pd.id === location?.external_penguin_data_id?.toString() || null
  );

  // Initialize local state from sampleGroup
  useEffect(() => {
    if (sampleGroup) {
      setLocalState({
        collectionTimeUTC: sampleGroup.collection_datetime_utc
          ? new Date(sampleGroup.collection_datetime_utc)
              .toISOString()
              .split('T')[1]
              .substring(0, 8)
          : '',
        notes: sampleGroup.notes || '',
        proximityCategory:
          (sampleGroup.proximity_category as ProximityCategory) || null,
        excluded: sampleGroup.excluded,
        penguinCount: sampleGroup.penguin_count ?? null,
        penguinPresent: sampleGroup.penguin_present ?? 0,
      });
    }
  }, [sampleGroup]);

  // Handlers
  const handleCollectionTimeUpdate = useCallback(
    async (timeString: string) => {
      if (!sampleGroup?.id) return;

      try {
        let collection_datetime_utc: string | undefined;
        if (timeString) {
          const datePart = sampleGroup.collection_date;
          const utcString = `${datePart}T${timeString}Z`;
          const utcDateTime = new Date(utcString);
          collection_datetime_utc = utcDateTime.toISOString();
        }
        setLocalState((prev) => ({ ...prev, collectionTimeUTC: timeString }));
        await updateSampleGroup(sampleGroup.id, { collection_datetime_utc });
      } catch (error) {
        console.error('Error updating collection time:', error);
        // revert on error
        setLocalState((prev) => ({
          ...prev,
          collectionTimeUTC: sampleGroup.collection_datetime_utc
            ? new Date(sampleGroup.collection_datetime_utc)
                .toISOString()
                .split('T')[1]
                .substring(0, 8)
            : '',
        }));
      }
    },
    [sampleGroup, updateSampleGroup]
  );

  const handleNotesUpdate = useCallback(
    async (newNotes: string) => {
      if (!sampleGroup?.id) return;
      try {
        setLocalState((prev) => ({ ...prev, notes: newNotes }));
        await updateSampleGroup(sampleGroup.id, { notes: newNotes });
      } catch (error) {
        console.error('Error updating notes:', error);
        setLocalState((prev) => ({
          ...prev,
          notes: sampleGroup.notes || '',
        }));
      }
    },
    [sampleGroup, updateSampleGroup]
  );

  const handleExcludedUpdate = useCallback(
    async (isExcluded: boolean) => {
      if (!sampleGroup?.id) return;
      try {
        setLocalState((prev) => ({ ...prev, excluded: isExcluded }));
        await updateSampleGroup(sampleGroup.id, { excluded: isExcluded });
      } catch (error) {
        console.error('Error updating excluded:', error);
        setLocalState((prev) => ({
          ...prev,
          excluded: sampleGroup.excluded,
        }));
      }
    },
    [sampleGroup, updateSampleGroup]
  );

  const handleProximityUpdate = useCallback(
    async (newProximity: ProximityCategory | null) => {
      if (!sampleGroup?.id) return;
      try {
        setLocalState((prev) => ({ ...prev, proximityCategory: newProximity }));
        await updateSampleGroup(sampleGroup.id, {
          proximity_category: newProximity,
        });
      } catch (error) {
        console.error('Error updating proximity category:', error);
        setLocalState((prev) => ({
          ...prev,
          proximityCategory:
            (sampleGroup.proximity_category as ProximityCategory) || null,
        }));
      }
    },
    [sampleGroup, updateSampleGroup]
  );

  const handlePenguinCountUpdate = useCallback(
    async (count: number | null) => {
      if (!sampleGroup?.id) return;
      try {
        setLocalState((prev) => ({ ...prev, penguinCount: count }));
        await updateSampleGroup(sampleGroup.id, { penguin_count: count });
      } catch (error) {
        console.error('Error updating penguin count:', error);
        setLocalState((prev) => ({
          ...prev,
          penguinCount: sampleGroup.penguin_count ?? null,
        }));
      }
    },
    [sampleGroup, updateSampleGroup]
  );

  const handlePenguinPresentUpdate = useCallback(
    async (isPresent: boolean) => {
      if (!sampleGroup?.id) return;
      const newValue = isPresent ? 1 : 0;
      try {
        setLocalState((prev) => ({ ...prev, penguinPresent: newValue }));
        await updateSampleGroup(sampleGroup.id, { penguin_present: newValue });
      } catch (error) {
        console.error('Error updating penguin present:', error);
        setLocalState((prev) => ({
          ...prev,
          penguinPresent: sampleGroup.penguin_present ?? 0,
        }));
      }
    },
    [sampleGroup, updateSampleGroup]
  );

  if (!sampleGroup) return null;

  // If localState.proximityCategory is null => NO_PROXIMITY_VALUE, else the real category
  const proximityValue =
    localState.proximityCategory === null
      ? NO_PROXIMITY_VALUE
      : localState.proximityCategory;

  return (
    <Card className='m-2 flex flex-col overflow-auto'>
      <Accordion
        type='single'
        collapsible
        value={isExpanded ? 'metadata' : ''}
        onValueChange={(val) => setIsExpanded(val === 'metadata')}
      >
        <AccordionItem value='metadata'>
          <AccordionTrigger className='flex items-center gap-2 px-4 py-2 font-semibold tracking-tight'>
            <AccordionHeader>
              {/* Instead of a plain <p className="text-base font-bold">, we use a heading style */}
              <p className='scroll-m-20 text-xl font-semibold leading-7 tracking-tight'>
                {sampleGroup.human_readable_sample_id || 'Unnamed Sample'}
              </p>
              {/* Replace text-xs text-gray-500 with a smaller, muted paragraph style */}
              <p className='text-sm text-muted-foreground mt-1'>
                Sample Group UUID: {sampleGroup.id || 'Unknown id'}
              </p>
            </AccordionHeader>
          </AccordionTrigger>
          <AccordionContent className='p-0 max-h-96 overflow-auto'>
            <CardContent className='flex flex-col gap-2'>
              {/* Sample ID */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Sample ID:
                </Label>
                <p className='flex-1 leading-7'>
                  {sampleGroup.human_readable_sample_id || 'N/A'}
                </p>
              </div>

              {/* Date */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Date:
                </Label>
                <p className='flex-1 leading-7'>
                  {sampleGroup.collection_date || 'N/A'}
                </p>
              </div>

              {/* Time (UTC) */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Time (UTC):
                </Label>
                <div className='flex-1'>
                  <TimePicker
                    value={localState.collectionTimeUTC}
                    onChange={(e) =>
                      hasModifyPermission && handleCollectionTimeUpdate(e || '')
                    }
                    className='leading-7'
                  />
                </div>
              </div>

              {/* Location */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Location:
                </Label>
                <p className='flex-1 leading-7'>
                  {location?.label || 'Unknown Location'}
                </p>
              </div>

              {/* Notes */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Notes:
                </Label>
                <div className='flex-1'>
                  <Textarea
                    rows={3}
                    value={localState.notes}
                    onChange={(e) =>
                      hasModifyPermission &&
                      setLocalState((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    onBlur={() =>
                      hasModifyPermission && handleNotesUpdate(localState.notes)
                    }
                    disabled={!hasModifyPermission}
                    className='leading-7 w-full'
                    placeholder='Add notes about this sample...'
                  />
                </div>
              </div>

              {/* Proximity Category */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Proximity:
                </Label>
                <div className='flex-1'>
                  <Select
                    value={proximityValue}
                    onValueChange={(val) => {
                      if (!hasModifyPermission) return;
                      const nextValue =
                        val === NO_PROXIMITY_VALUE
                          ? null
                          : (val as ProximityCategory);
                      handleProximityUpdate(nextValue);
                    }}
                    disabled={!hasModifyPermission}
                  >
                    <SelectTrigger className='leading-7'>
                      <SelectValue placeholder='None' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROXIMITY_VALUE}>None</SelectItem>
                      {Object.values(ProximityCategory).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Location Fields */}
              <LocationFields
                sampleGroup={sampleGroup as SampleGroupMetadata}
                metadataItemStyles='py-1'
                labelStyles='w-36 text-sm font-medium leading-7 text-muted-foreground'
                disabled={!hasModifyPermission}
              />

              {/* Penguin Count */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Penguin Count:
                </Label>
                <div className='flex-1'>
                  <Input
                    type='number'
                    value={localState.penguinCount ?? ''}
                    onChange={(e) => {
                      if (!hasModifyPermission) return;
                      const val = e.target.value;
                      setLocalState((prev) => ({
                        ...prev,
                        penguinCount: val === '' ? null : parseInt(val, 10),
                      }));
                    }}
                    onBlur={() =>
                      hasModifyPermission &&
                      handlePenguinCountUpdate(localState.penguinCount)
                    }
                    disabled={!hasModifyPermission}
                    className='leading-7 w-full'
                  />
                </div>
              </div>

              {/* External penguin data hint */}
              {location?.external_penguin_data_id &&
                penguinRecord &&
                penguinRecord.penguin_count > 0 && (
                  <div className='mb-2 rounded bg-muted px-2 py-1 leading-7'>
                    <div className='inline-flex items-center text-muted-foreground'>
                      <img
                        src={PenguinIcon}
                        alt='Penguin Icon'
                        className='w-6 h-6 mr-2'
                      />
                      Oceanities recorded {penguinRecord.penguin_count}{' '}
                      {penguinRecord.common_name} {penguinRecord.count_type} on{' '}
                      {penguinRecord.day || 'DD'}/{penguinRecord.month || 'MM'}/
                      {penguinRecord.year}.
                    </div>
                  </div>
                )}

              {/* Penguins Present */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Penguins Present:
                </Label>
                <div className='flex-1'>
                  <Switch
                    checked={Boolean(localState.penguinPresent)}
                    onCheckedChange={(checked) =>
                      hasModifyPermission && handlePenguinPresentUpdate(checked)
                    }
                    disabled={!hasModifyPermission}
                  />
                </div>
              </div>

              {/* Excluded */}
              <div className='flex items-start py-1'>
                <Label className='w-36 text-sm font-medium leading-7 text-muted-foreground'>
                  Excluded:
                </Label>
                <div className='flex-1'>
                  <Switch
                    checked={Boolean(localState.excluded)}
                    onCheckedChange={(checked) =>
                      hasModifyPermission && handleExcludedUpdate(checked)
                    }
                    disabled={!hasModifyPermission}
                  />
                </div>
              </div>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
