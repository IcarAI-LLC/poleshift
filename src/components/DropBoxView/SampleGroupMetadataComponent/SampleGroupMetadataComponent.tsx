import React, { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'

import { useData, useUI } from '../../../lib/hooks'
import { useAuthStore } from '../../../lib/stores/authStore.ts'
import LocationFields from './LocationFields.tsx'

import type { SampleGroupMetadata as TSampleGroupMetadata } from '../../../lib/types'
import { PoleshiftPermissions } from '@/lib/types'
import { ProximityCategory } from '@/lib/powersync/DrizzleSchema.ts'
import PenguinIcon from '@/assets/icons/penguin.svg'

// shadcn/ui components
import { Card, CardContent } from '@/components/ui/card.tsx'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion.tsx'
import { Switch } from '@/components/ui/switch.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import { Label } from '@/components/ui/label.tsx'

/**
 * Special string value to represent "no proximity category"
 * (rather than using an empty string).
 */
const NO_PROXIMITY_VALUE = 'NO_PROXIMITY_VALUE'

export const SampleGroupMetadataComponent: React.FC = () => {
  const { locations, updateSampleGroup, sampleGroups, penguinData } = useData()
  const { selectedLeftItem } = useUI()
  const { userPermissions } = useAuthStore.getState()

  // Check if the user has ModifySampleGroup permission
  const hasModifyPermission = userPermissions?.includes(
      PoleshiftPermissions.ModifySampleGroup
  )

  const [isExpanded, setIsExpanded] = useState<boolean>(true)
  const [localState, setLocalState] = useState<{
    collectionTimeUTC: string
    notes: string
    proximityCategory: ProximityCategory | null
    excluded: boolean
    penguinCount: number | null
    penguinPresent: number
  }>({
    collectionTimeUTC: '',
    notes: '',
    proximityCategory: null,
    excluded: false,
    penguinCount: null,
    penguinPresent: 0,
  })

  // Get current sample group
  const sampleGroup = selectedLeftItem ? sampleGroups[selectedLeftItem.id] : null
  const location = sampleGroup?.loc_id
      ? locations.find((loc) => loc.id === sampleGroup.loc_id)
      : null
  const penguinRecord = penguinData.find(
      (data) => data.id === location?.external_penguin_data_id?.toString() || null
  )

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
      })
    }
  }, [sampleGroup])

  // Handlers
  const handleCollectionTimeUpdate = useCallback(
      async (timeString: string) => {
        if (!sampleGroup?.id) return

        try {
          let collection_datetime_utc: string | undefined

          if (timeString) {
            const utcDateTimeString = `${sampleGroup.collection_date}T${timeString}Z`
            const utcDateTime = new Date(utcDateTimeString)
            collection_datetime_utc = utcDateTime.toISOString()
          }

          setLocalState((prev) => ({
            ...prev,
            collectionTimeUTC: timeString,
          }))

          await updateSampleGroup(sampleGroup.id, { collection_datetime_utc })
        } catch (error) {
          console.error('Error updating collection time:', error)
          // Reset to previous value on error
          setLocalState((prev) => ({
            ...prev,
            collectionTimeUTC: sampleGroup.collection_datetime_utc
                ? new Date(sampleGroup.collection_datetime_utc)
                    .toISOString()
                    .split('T')[1]
                    .substring(0, 8)
                : '',
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  const handleNotesUpdate = useCallback(
      async (newNotes: string) => {
        if (!sampleGroup?.id) return

        try {
          setLocalState((prev) => ({
            ...prev,
            notes: newNotes,
          }))

          await updateSampleGroup(sampleGroup.id, { notes: newNotes })
        } catch (error) {
          console.error('Error updating notes:', error)
          setLocalState((prev) => ({
            ...prev,
            notes: sampleGroup.notes || '',
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  const handleExcludedUpdate = useCallback(
      async (isExcluded: boolean) => {
        if (!sampleGroup?.id) return

        try {
          setLocalState((prev) => ({
            ...prev,
            excluded: isExcluded,
          }))

          await updateSampleGroup(sampleGroup.id, { excluded: isExcluded })
        } catch (error) {
          console.error('Error updating excluded:', error)
          setLocalState((prev) => ({
            ...prev,
            excluded: sampleGroup.excluded,
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  const handleProximityUpdate = useCallback(
      async (newProximity: ProximityCategory | null) => {
        if (!sampleGroup?.id) return

        try {
          setLocalState((prev) => ({
            ...prev,
            proximityCategory: newProximity,
          }))

          await updateSampleGroup(sampleGroup.id, {
            proximity_category: newProximity,
          })
        } catch (error) {
          console.error('Error updating proximity category:', error)
          setLocalState((prev) => ({
            ...prev,
            proximityCategory:
                (sampleGroup.proximity_category as ProximityCategory) || null,
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  const handlePenguinCountUpdate = useCallback(
      async (count: number | null) => {
        if (!sampleGroup?.id) return

        try {
          setLocalState((prev) => ({
            ...prev,
            penguinCount: count,
          }))

          await updateSampleGroup(sampleGroup.id, { penguin_count: count })
        } catch (error) {
          console.error('Error updating penguin count:', error)
          setLocalState((prev) => ({
            ...prev,
            penguinCount: sampleGroup.penguin_count ?? null,
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  const handlePenguinPresentUpdate = useCallback(
      async (isPresent: boolean) => {
        if (!sampleGroup?.id) return

        const newValue = isPresent ? 1 : 0
        try {
          setLocalState((prev) => ({
            ...prev,
            penguinPresent: newValue,
          }))

          await updateSampleGroup(sampleGroup.id, { penguin_present: newValue })
        } catch (error) {
          console.error('Error updating penguin present:', error)
          // Reset on error
          setLocalState((prev) => ({
            ...prev,
            penguinPresent: sampleGroup.penguin_present ?? 0,
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  if (!sampleGroup) return null

  /**
   * Determine the current value for the proximity <Select>
   * If localState.proximityCategory is null => use NO_PROXIMITY_VALUE
   * Otherwise use the actual category string.
   */
  const proximityValue =
      localState.proximityCategory === null
          ? NO_PROXIMITY_VALUE
          : localState.proximityCategory

  return (
      <Card className="m-2 mt-[var(--header-height)] max-h-[calc(100vh-180px)] flex flex-col overflow-hidden rounded-md shadow-sm bg-neutral-900 text-white">
        <Accordion
            type="single"
            collapsible
            value={isExpanded ? 'metadata' : ''}
            onValueChange={(val) => setIsExpanded(val === 'metadata')}
            className="flex flex-col flex-1 overflow-hidden"
        >
          <AccordionItem value="metadata" className="-0">
            <AccordionTrigger className=" flex items-center gap-2 px-4 py-2 text-sm font-medium">
              {/* Header area */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <p className="text-base font-bold">
                  {sampleGroup.human_readable_sample_id || 'Unnamed Sample'}
                </p>
                <p className="text-sm text-muted-foreground">
                   Sample Group UUID:{' '}
                  {sampleGroup.id || 'Unknown id'}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-0 h-full max-h-[calc(100vh-240px)] overflow-y-auto overflow-x-hidden border-none">
              <CardContent className="flex flex-col gap-2 pb-4">
                {/* Sample ID */}
                <div className="flex items-start py-2">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Sample ID:
                  </Label>
                  <div className="flex-1 text-sm">
                    {sampleGroup.human_readable_sample_id || 'N/A'}
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Date:
                  </Label>
                  <div className="flex-1 text-sm">
                    {sampleGroup.collection_date || 'N/A'}
                  </div>
                </div>

                {/* Time (UTC) */}
                <div className="flex items-start  py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Time (UTC):
                  </Label>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Clock size={16} className="mr-2 text-muted-foreground" />
                      <Input
                          type="time"
                          step="1"
                          value={localState.collectionTimeUTC}
                          onChange={(e) => {
                            if (hasModifyPermission) {
                              handleCollectionTimeUpdate(e.target.value)
                            }
                          }}
                          disabled={!hasModifyPermission}
                          className="w-[120px] text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start  py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Location:
                  </Label>
                  <div className="flex-1 text-sm">
                    {location?.label || 'Unknown Location'}
                  </div>
                </div>

                {/* Notes */}
                <div className="flex items-start  py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Notes:
                  </Label>
                  <div className="flex-1">
                    <Textarea
                        rows={3}
                        value={localState.notes}
                        onChange={(e) =>
                            hasModifyPermission &&
                            setLocalState((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        onBlur={() =>
                            hasModifyPermission && handleNotesUpdate(localState.notes)
                        }
                        placeholder="Add notes about this sample..."
                        disabled={!hasModifyPermission}
                        className="text-sm"
                    />
                  </div>
                </div>

                {/* Proximity Category */}
                <div className="flex items-start  py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Proximity:
                  </Label>
                  <div className="flex-1">
                    <Select
                        value={proximityValue}
                        onValueChange={(val) => {
                          if (!hasModifyPermission) return

                          // If user selected "NO_PROXIMITY_VALUE", interpret as null
                          const nextValue =
                              val === NO_PROXIMITY_VALUE ? null : (val as ProximityCategory)
                          handleProximityUpdate(nextValue)
                        }}
                        disabled={!hasModifyPermission}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* We use a real value instead of "" */}
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

                {/* Location Fields (sub-component) */}
                <LocationFields
                    sampleGroup={sampleGroup as TSampleGroupMetadata}
                    metadataItemStyles="py-2 gap-2"
                    labelStyles="w-[180px] text-muted-foreground text-sm"
                    darkFieldStyles="" // or some relevant tailwind classes
                    disabled={!hasModifyPermission}
                />

                {/* Penguin Count */}
                <div className="flex items-start  py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Penguin Count:
                  </Label>
                  <div className="flex-1">
                    <Input
                        type="number"
                        value={localState.penguinCount ?? ''}
                        onChange={(e) => {
                          if (!hasModifyPermission) return
                          const val = e.target.value
                          setLocalState((prev) => ({
                            ...prev,
                            penguinCount: val === '' ? null : parseInt(val, 10),
                          }))
                        }}
                        onBlur={() =>
                            hasModifyPermission &&
                            handlePenguinCountUpdate(localState.penguinCount)
                        }
                        disabled={!hasModifyPermission}
                        className="text-sm"
                    />
                  </div>
                </div>

                {/* External penguin data hint (Oceanities) */}
                {location?.external_penguin_data_id &&
                    penguinData[location.external_penguin_data_id] &&
                    penguinData[location.external_penguin_data_id].penguin_count > 0 && (
                        <div
                            className="mb-2 rounded px-2 py-1 text-sm"
                            style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
                        >
                          <p className="inline-flex items-center text-muted-foreground">
                            <img
                                src={PenguinIcon}
                                alt="Penguin Icon"
                                style={{ width: 24, height: 24, marginRight: 8 }}
                            />
                            &nbsp;Oceanities recorded{' '}
                            {penguinRecord?.penguin_count} {penguinRecord?.common_name}{' '}
                            {penguinRecord?.count_type} on {penguinRecord?.day || 'DD'}/
                            {penguinRecord?.month || 'MM'}/{penguinRecord?.year}.
                          </p>
                        </div>
                    )}

                {/* Penguins Present */}
                <div className="flex items-center justify-left  py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Penguins Present:
                  </Label>
                  <Switch
                      className={"data-[state=checked]:bg-fuchsia-800 data-[state=unchecked]:bg-neutral-400"}
                      checked={Boolean(localState.penguinPresent)}
                      onCheckedChange={(checked) =>
                          hasModifyPermission && handlePenguinPresentUpdate(checked)
                      }
                      disabled={!hasModifyPermission}
                  />
                </div>

                {/* Excluded */}
                <div className="flex items-center justify-left  py-2 ">
                  <Label className="w-[180px] text-muted-foreground text-sm">
                    Excluded:
                  </Label>
                  <Switch
                      className={"data-[state=checked]:bg-fuchsia-800 data-[state=unchecked]:bg-neutral-400"}
                      checked={Boolean(localState.excluded)}
                      onCheckedChange={(checked) =>
                          hasModifyPermission && handleExcludedUpdate(checked)
                      }
                      disabled={!hasModifyPermission}
                  />
                </div>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
  )
}

export default SampleGroupMetadataComponent;
