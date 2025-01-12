
import { useState, useEffect, useCallback } from "react"
import { Clock } from "lucide-react"

import { useData, useUI } from "../../hooks"
import { useAuthStore } from "@/stores/authStore.ts"
import type { SampleGroupMetadata as TSampleGroupMetadata } from "../../types"
import { PoleshiftPermissions } from "src/types"
import { ProximityCategory } from "@/lib/powersync/DrizzleSchema.ts"
import PenguinIcon from "../../assets/icons/penguin.svg"

import { Card, CardContent } from "@/components/ui/card.tsx"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import { Label } from "@/components/ui/label.tsx"
import LocationFields from "./LocationFields.tsx"

/**
 * Special string value for "no proximity category"
 * rather than an empty string
 */
const NO_PROXIMITY_VALUE = "NO_PROXIMITY_VALUE"

export default function SampleGroupMetadataComponent() {
  const { locations, updateSampleGroup, sampleGroups, penguinData } = useData()
  const { selectedLeftItem } = useUI()
  const { userPermissions } = useAuthStore.getState()

  const hasModifyPermission = userPermissions?.includes(
      PoleshiftPermissions.ModifySampleGroup
  )

  const [isExpanded, setIsExpanded] = useState(true)
  const [localState, setLocalState] = useState({
    collectionTimeUTC: "",
    notes: "",
    proximityCategory: null as ProximityCategory | null,
    excluded: false,
    penguinCount: null as number | null,
    penguinPresent: 0,
  })

  // Identify the sample group
  const sampleGroup =
      selectedLeftItem ? sampleGroups[selectedLeftItem.id] : null

  // Identify the location and penguin record
  const location = sampleGroup?.loc_id
      ? locations.find((loc) => loc.id === sampleGroup.loc_id)
      : null

  const penguinRecord = penguinData.find(
      (pd) => pd.id === location?.external_penguin_data_id?.toString() || null
  )

  // Initialize local state from sampleGroup
  useEffect(() => {
    if (sampleGroup) {
      setLocalState({
        collectionTimeUTC: sampleGroup.collection_datetime_utc
            ? new Date(sampleGroup.collection_datetime_utc)
                .toISOString()
                .split("T")[1]
                .substring(0, 8)
            : "",
        notes: sampleGroup.notes || "",
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
            const datePart = sampleGroup.collection_date
            const utcString = `${datePart}T${timeString}Z`
            const utcDateTime = new Date(utcString)
            collection_datetime_utc = utcDateTime.toISOString()
          }
          setLocalState((prev) => ({ ...prev, collectionTimeUTC: timeString }))
          await updateSampleGroup(sampleGroup.id, { collection_datetime_utc })
        } catch (error) {
          console.error("Error updating collection time:", error)
          // revert on error
          setLocalState((prev) => ({
            ...prev,
            collectionTimeUTC: sampleGroup.collection_datetime_utc
                ? new Date(sampleGroup.collection_datetime_utc)
                    .toISOString()
                    .split("T")[1]
                    .substring(0, 8)
                : "",
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  const handleNotesUpdate = useCallback(
      async (newNotes: string) => {
        if (!sampleGroup?.id) return
        try {
          setLocalState((prev) => ({ ...prev, notes: newNotes }))
          await updateSampleGroup(sampleGroup.id, { notes: newNotes })
        } catch (error) {
          console.error("Error updating notes:", error)
          setLocalState((prev) => ({
            ...prev,
            notes: sampleGroup.notes || "",
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  const handleExcludedUpdate = useCallback(
      async (isExcluded: boolean) => {
        if (!sampleGroup?.id) return
        try {
          setLocalState((prev) => ({ ...prev, excluded: isExcluded }))
          await updateSampleGroup(sampleGroup.id, { excluded: isExcluded })
        } catch (error) {
          console.error("Error updating excluded:", error)
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
          setLocalState((prev) => ({ ...prev, proximityCategory: newProximity }))
          await updateSampleGroup(sampleGroup.id, {
            proximity_category: newProximity,
          })
        } catch (error) {
          console.error("Error updating proximity category:", error)
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
          setLocalState((prev) => ({ ...prev, penguinCount: count }))
          await updateSampleGroup(sampleGroup.id, { penguin_count: count })
        } catch (error) {
          console.error("Error updating penguin count:", error)
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
          setLocalState((prev) => ({ ...prev, penguinPresent: newValue }))
          await updateSampleGroup(sampleGroup.id, { penguin_present: newValue })
        } catch (error) {
          console.error("Error updating penguin present:", error)
          setLocalState((prev) => ({
            ...prev,
            penguinPresent: sampleGroup.penguin_present ?? 0,
          }))
        }
      },
      [sampleGroup, updateSampleGroup]
  )

  if (!sampleGroup) return null

  // If localState.proximityCategory is null => NO_PROXIMITY_VALUE, else the real category
  const proximityValue =
      localState.proximityCategory === null
          ? NO_PROXIMITY_VALUE
          : localState.proximityCategory

  return (
      <Card className="m-2 flex flex-col overflow-hidden">
        <Accordion
            type="single"
            collapsible
            value={isExpanded ? "metadata" : ""}
            onValueChange={(val) => setIsExpanded(val === "metadata")}
            className="flex flex-col flex-1 overflow-hidden"
        >
          <AccordionItem value="metadata">
            <AccordionTrigger className="flex items-center gap-2 px-4 py-2 text-sm font-medium">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <p className="text-base font-bold">
                  {sampleGroup.human_readable_sample_id || "Unnamed Sample"}
                </p>
                <p className="text-xs text-gray-500">
                  Sample Group UUID: {sampleGroup.id || "Unknown id"}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-0 max-h-96 overflow-auto">
              <CardContent className="flex flex-col gap-2">
                {/* Sample ID */}
                <div className="flex items-start py-1">
                  <Label className="w-36 text-gray-500 text-sm">Sample ID:</Label>
                  <div className="flex-1 text-sm">
                    {sampleGroup.human_readable_sample_id || "N/A"}
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start py-1">
                  <Label className="w-36 text-gray-500 text-sm">Date:</Label>
                  <div className="flex-1 text-sm">
                    {sampleGroup.collection_date || "N/A"}
                  </div>
                </div>

                {/* Time (UTC) */}
                <div className="flex items-start py-1">
                  <Label className="w-36 text-gray-500 text-sm">Time (UTC):</Label>
                  <div className="flex-1 flex items-center">
                    <Clock size={16} className="mr-2 text-gray-500" />
                    <Input
                        type="time"
                        step="1"
                        value={localState.collectionTimeUTC}
                        onChange={(e) =>
                            hasModifyPermission && handleCollectionTimeUpdate(e.target.value)
                        }
                        disabled={!hasModifyPermission}
                        className="w-[120px] text-sm"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start py-1">
                  <Label className="w-36 text-gray-500 text-sm">Location:</Label>
                  <div className="flex-1 text-sm">
                    {location?.label || "Unknown Location"}
                  </div>
                </div>

                {/* Notes */}
                <div className="flex items-start py-1">
                  <Label className="w-36 text-gray-500 text-sm">Notes:</Label>
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
                        disabled={!hasModifyPermission}
                        className="text-sm"
                        placeholder="Add notes about this sample..."
                    />
                  </div>
                </div>

                {/* Proximity Category */}
                <div className="flex items-start py-1">
                  <Label className="w-36 text-gray-500 text-sm">Proximity:</Label>
                  <div className="flex-1">
                    <Select
                        value={proximityValue}
                        onValueChange={(val) => {
                          if (!hasModifyPermission) return
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
                    metadataItemStyles="py-1"
                    labelStyles="w-36 text-gray-500 text-sm"
                    disabled={!hasModifyPermission}
                />

                {/* Penguin Count */}
                <div className="flex items-start py-1">
                  <Label className="w-36 text-gray-500 text-sm">Penguin Count:</Label>
                  <div className="flex-1">
                    <Input
                        type="number"
                        value={localState.penguinCount ?? ""}
                        onChange={(e) => {
                          if (!hasModifyPermission) return
                          const val = e.target.value
                          setLocalState((prev) => ({
                            ...prev,
                            penguinCount: val === "" ? null : parseInt(val, 10),
                          }))
                        }}
                        onBlur={() =>
                            hasModifyPermission && handlePenguinCountUpdate(localState.penguinCount)
                        }
                        disabled={!hasModifyPermission}
                        className="text-sm"
                    />
                  </div>
                </div>

                {/* External penguin data hint */}
                {location?.external_penguin_data_id &&
                    penguinRecord &&
                    penguinRecord.penguin_count > 0 && (
                        <div className="mb-2 rounded bg-gray-50 px-2 py-1 text-sm">
                          <div className="inline-flex items-center text-gray-500">
                            <img
                                src={PenguinIcon}
                                alt="Penguin Icon"
                                className="w-6 h-6 mr-2"
                            />
                            Oceanities recorded {penguinRecord.penguin_count}{" "}
                            {penguinRecord.common_name} {penguinRecord.count_type} on{" "}
                            {penguinRecord.day || "DD"}/{penguinRecord.month || "MM"}/
                            {penguinRecord.year}.
                          </div>
                        </div>
                    )}

                {/* Penguins Present */}
                <div className="flex items-center py-1">
                  <Label className="w-36 text-gray-500 text-sm">Penguins Present:</Label>
                  <Switch
                      checked={Boolean(localState.penguinPresent)}
                      onCheckedChange={(checked) =>
                          hasModifyPermission && handlePenguinPresentUpdate(checked)
                      }
                      disabled={!hasModifyPermission}
                  />
                </div>

                {/* Excluded */}
                <div className="flex items-center py-1">
                  <Label className="w-36 text-gray-500 text-sm">Excluded:</Label>
                  <Switch
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
