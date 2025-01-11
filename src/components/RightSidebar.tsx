import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

// --- shadcn/ui components ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
// Icons from lucide-react (commonly used with shadcn/ui)
import { X } from "lucide-react";

// --- Your custom hooks and data methods ---
import { usePowerSync, useQuery } from "@powersync/react";
import { useUI, useData } from "../lib/hooks";
import {
  DrizzleSchema,
  processed_data_improved,
  processed_ctd_rbr_data_values,
  processed_nutrient_ammonia_data,
  processed_kraken_uniq_report,
  sample_group_metadata,
  DataType,
} from "../lib/powersync/DrizzleSchema";
import { eq, and, inArray } from "drizzle-orm";
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";

interface ProcessedStats {
  average_temperature: number | null;
  average_salinity: number | null;
  ammonium_stats: {
    average: number | null;
    min: number | null;
    max: number | null;
    count: number;
  };
  species_data: Record<string, number>;
  genus_data: Record<string, number>;
}

const initialStats: ProcessedStats = {
  average_temperature: null,
  average_salinity: null,
  ammonium_stats: { average: null, min: null, max: null, count: 0 },
  species_data: {},
  genus_data: {},
};

const RightSidebar: React.FC = () => {
  const {
    selectedRightItem,
    setSelectedRightItem,
    isRightSidebarCollapsed,
    toggleRightSidebar,
    filters,
  } = useUI();
  const { sampleGroups } = useData();

  const [stats, setStats] = useState<ProcessedStats>(initialStats);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(25);

  // Setup your DB layer with Drizzle
  const db = usePowerSync();
  const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setSelectedRightItem(null);
    toggleRightSidebar();
  }, [setSelectedRightItem, toggleRightSidebar]);

  const handleConfidenceChange = useCallback((newValue: number[]) => {
    // shadcn/ui Slider onValueChange gives an array
    setConfidenceThreshold(newValue[0]);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Filter sample groups by the currently selected location + date
  // ─────────────────────────────────────────────────────────────
  const samplesAtLocation = useMemo(() => {
    if (!selectedRightItem) return [];
    return Object.values(sampleGroups).filter(
        (group: typeof sample_group_metadata.$inferSelect) => {
          // 1) Must match location
          if (group.loc_id !== selectedRightItem.id) return false;

          // 2) Filter by selectedLocations
          if (
              filters.selectedLocations.length > 0 &&
              !filters.selectedLocations.includes(group.loc_id)
          ) {
            return false;
          }

          // 3) Filter out "excluded" if showExcluded=false
          if (!filters.showExcluded && group.excluded === true) {
            return false;
          }

          // 4) Date range
          if (group.collection_date) {
            const sampleDate = DateTime.fromISO(group.collection_date);
            if (filters.startDate && sampleDate < DateTime.fromISO(filters.startDate)) {
              return false;
            }
            if (filters.endDate && sampleDate > DateTime.fromISO(filters.endDate)) {
              return false;
            }
          }

          return true;
        }
    );
  }, [selectedRightItem, sampleGroups, filters]);

  const sampleIds = useMemo(() => samplesAtLocation.map((g) => g.id), [samplesAtLocation]);

  // ─────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────
  const ctdDataQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_data_improved)
        .where(
            and(
                eq(processed_data_improved.data_type, DataType.CTD),
                sampleIds.length
                    ? inArray(processed_data_improved.sample_id, sampleIds)
                    : eq(processed_data_improved.sample_id, "FALSE")
            )
        );
  }, [drizzleDB, sampleIds]);

  const nutrientDataQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_data_improved)
        .where(
            and(
                eq(processed_data_improved.data_type, DataType.NutrientAmmonia),
                sampleIds.length
                    ? inArray(processed_data_improved.sample_id, sampleIds)
                    : eq(processed_data_improved.sample_id, "FALSE")
            )
        );
  }, [drizzleDB, sampleIds]);

  const sequenceDataQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_data_improved)
        .where(
            and(
                eq(processed_data_improved.data_type, DataType.Sequence),
                sampleIds.length
                    ? inArray(processed_data_improved.sample_id, sampleIds)
                    : eq(processed_data_improved.sample_id, "FALSE")
            )
        );
  }, [drizzleDB, sampleIds]);

  const ctdData = useQuery(toCompilableQuery(ctdDataQuery)).data || [];
  const nutrientData = useQuery(toCompilableQuery(nutrientDataQuery)).data || [];
  const sequenceData = useQuery(toCompilableQuery(sequenceDataQuery)).data || [];

  // Detail queries
  const ctdIds = useMemo(() => ctdData.map((d) => d.id), [ctdData]);
  const ctdDetailQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_ctd_rbr_data_values)
        .where(
            ctdIds.length
                ? inArray(processed_ctd_rbr_data_values.processed_data_id, ctdIds)
                : eq(processed_ctd_rbr_data_values.processed_data_id, "FALSE")
        );
  }, [drizzleDB, ctdIds]);
  const ctdDetailRows = useQuery(toCompilableQuery(ctdDetailQuery)).data || [];

  const nutrientIds = useMemo(() => nutrientData.map((d) => d.id), [nutrientData]);
  const nutrientDetailQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_nutrient_ammonia_data)
        .where(
            nutrientIds.length
                ? inArray(processed_nutrient_ammonia_data.processed_data_id, nutrientIds)
                : eq(processed_nutrient_ammonia_data.processed_data_id, "FALSE")
        );
  }, [drizzleDB, nutrientIds]);
  const nutrientDetailRows = useQuery(toCompilableQuery(nutrientDetailQuery)).data || [];

  const sequenceIds = useMemo(() => sequenceData.map((d) => d.id), [sequenceData]);
  const sequenceDetailQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_kraken_uniq_report)
        .where(
            sequenceIds.length
                ? inArray(processed_kraken_uniq_report.processed_data_id, sequenceIds)
                : eq(processed_kraken_uniq_report.processed_data_id, "FALSE")
        );
  }, [drizzleDB, sequenceIds]);
  const sequenceDetailRows = useQuery(toCompilableQuery(sequenceDetailQuery)).data || [];

  // ─────────────────────────────────────────────────────────────
  // Compute stats in the frontend
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRightItem || sampleIds.length === 0) {
      setStats(initialStats);
      return;
    }

    // A) Average temp & salinity (depth <= 2m)
    let totalTemp = 0;
    let tempCount = 0;
    let totalSalinity = 0;
    let salCount = 0;

    for (const row of ctdDetailRows) {
      if (row.depth != null && row.depth <= 2) {
        if (typeof row.temperature === "number") {
          totalTemp += row.temperature;
          tempCount++;
        }
        if (typeof row.salinity === "number") {
          totalSalinity += row.salinity;
          salCount++;
        }
      }
    }

    const average_temperature = tempCount > 0 ? totalTemp / tempCount : null;
    const average_salinity = salCount > 0 ? totalSalinity / salCount : null;

    // B) Ammonium stats
    const ammoniumVals: number[] = [];
    for (const row of nutrientDetailRows) {
      if (typeof row.ammonium === "number") {
        ammoniumVals.push(row.ammonium);
      }
    }
    let ammonium_stats = {
      average: null as number | null,
      min: null as number | null,
      max: null as number | null,
      count: 0,
    };
    if (ammoniumVals.length > 0) {
      const sum = ammoniumVals.reduce((acc, val) => acc + val, 0);
      ammonium_stats.average = sum / ammoniumVals.length;
      ammonium_stats.min = Math.min(...ammoniumVals);
      ammonium_stats.max = Math.max(...ammoniumVals);
      ammonium_stats.count = ammoniumVals.length;
    }

    // C) Sequence data
    const species_data: Record<string, number> = {};
    const genus_data: Record<string, number> = {};

    for (const row of sequenceDetailRows) {
      const percentage = row.percentage;
      if (typeof percentage !== "number") continue;
      if (percentage > confidenceThreshold) {
        if (row.rank === "species") {
          species_data[row.tax_name] = (species_data[row.tax_name] || 0) + 1;
        } else if (row.rank === "genus") {
          genus_data[row.tax_name] = (genus_data[row.tax_name] || 0) + 1;
        }
      }
    }

    setStats({
      average_temperature,
      average_salinity,
      ammonium_stats,
      species_data,
      genus_data,
    });
  }, [
    selectedRightItem,
    sampleIds,
    ctdDetailRows,
    nutrientDetailRows,
    sequenceDetailRows,
    confidenceThreshold,
  ]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  if (!selectedRightItem) {
    return (
        <div className="right-sidebar collapsed">
          {/* Optional: a placeholder or message */}
        </div>
    );
  }

  return (
      <div
          className={`right-sidebar ${
              isRightSidebarCollapsed ? "collapsed" : ""
          } border-neutral-200 bg-white relative flex flex-col w-full md:w-[400px]`}
      >
        {/* Close Button */}
        <div className="absolute top-2 left-2">
          <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close Sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-4 pt-10">
          {/* Location info */}
          <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-3">
            {selectedRightItem.label}
          </h2>
          <p className="text-sm mb-2">
            <strong>Location ID:</strong> {selectedRightItem.char_id}
          </p>
          <p className="text-sm mb-2">
            <strong>Latitude:</strong> {selectedRightItem.lat}
          </p>
          <p className="text-sm">
            <strong>Longitude:</strong> {selectedRightItem.long}
          </p>

          <Separator className="my-4" />

          {/* Confidence Threshold Slider */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Sequence Abundance Threshold</CardTitle>
            </CardHeader>
            <CardContent>
              <Slider
                  value={[confidenceThreshold]}
                  onValueChange={handleConfidenceChange}
                  max={100}
                  step={5}
                  defaultValue={[25]}
              />
              <p className="text-xs text-muted-foreground text-center mt-2">
                Showing taxa with &gt;{confidenceThreshold}% inter-sample read abundance
              </p>
            </CardContent>
          </Card>

          {/* Temperature & Salinity */}
          {(stats.average_temperature !== null || stats.average_salinity !== null) && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">
                    Average Measurements (First 2 Meters)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stats.average_temperature !== null ? (
                      <p>
                        <strong>Temperature:</strong>{" "}
                        {stats.average_temperature.toFixed(2)} °C
                      </p>
                  ) : (
                      <p>Temperature data not available for the first 2 meters.</p>
                  )}
                  {stats.average_salinity !== null ? (
                      <p>
                        <strong>Salinity:</strong> {stats.average_salinity.toFixed(2)} PSU
                      </p>
                  ) : (
                      <p>Salinity data not available for the first 2 meters.</p>
                  )}
                </CardContent>
              </Card>
          )}

          {/* Ammonium Stats */}
          {stats.ammonium_stats.count > 0 && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">Ammonium Measurements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <p>
                        <strong>Average:</strong>{" "}
                        {stats.ammonium_stats.average?.toFixed(2)} µmol/L
                      </p>
                      <p>
                        <strong>Minimum:</strong>{" "}
                        {stats.ammonium_stats.min?.toFixed(2)} µmol/L
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Maximum:</strong>{" "}
                        {stats.ammonium_stats.max?.toFixed(2)} µmol/L
                      </p>
                      <p>
                        <strong>Samples:</strong> {stats.ammonium_stats.count}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
          )}

          {/* Species Data */}
          {Object.keys(stats.species_data).length > 0 && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">Species Identified</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(stats.species_data)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 100)
                      .map(([species, count]) => (
                          <p key={species}>
                            <strong>{species}</strong>: {count} sample(s)
                          </p>
                      ))}
                </CardContent>
              </Card>
          )}

          {/* Samples List */}
          {samplesAtLocation.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Samples at this Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {samplesAtLocation.map((sampleGroup) => (
                        <div
                            key={sampleGroup.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between"
                        >
                          <p className="text-sm">
                            <strong>{sampleGroup.human_readable_sample_id}</strong>
                            {sampleGroup.excluded && (
                                <span className="ml-2 text-red-500 italic text-xs">
                          (Excluded)
                        </span>
                            )}
                          </p>
                          {sampleGroup.collection_date && (
                              <p className="text-xs text-muted-foreground">
                                {DateTime.fromISO(sampleGroup.collection_date).toLocaleString(
                                    DateTime.DATE_MED
                                )}
                              </p>
                          )}
                        </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
          )}
        </div>
      </div>
  );
};

export default RightSidebar;
