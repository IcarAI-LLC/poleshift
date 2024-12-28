import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  IconButton,
  Slider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DateTime } from 'luxon';
import { usePowerSync, useQuery } from '@powersync/react';
import {
  DrizzleSchema,
  processed_data_improved,
  processed_ctd_rbr_data_values,
  processed_nutrient_ammonia_data,
  processed_kraken_uniq_report,
} from '../lib/powersync/DrizzleSchema';
import { and, eq, sql } from 'drizzle-orm';
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';

import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { useUI, useData } from '../lib/hooks';
import type { SampleGroupMetadata } from '../lib/types';
import { DataType } from '../lib/types';

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

  // Database setup
  const db = usePowerSync();
  const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });

  // ─────────────────────────────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────────────────────────────
  const styles = useMemo(
      (): Record<string, SxProps<Theme>> => ({
        closeButton: {
          position: 'absolute',
          top: 2,
          left: 2,
          color: 'common.white',
          '&:hover': {
            color: 'primary.main',
          },
        },
        contentBox: {
          p: 3,
          overflowY: 'auto',
          height: '100%',
        },
        card: {
          mb: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
        },
        sliderCard: {
          mb: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        },
        divider: {
          my: 2,
        },
        cardContent: {
          '&:last-child': {
            pb: 2,
          },
        },
      }),
      []
  );

  // ─────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setSelectedRightItem(null);
    toggleRightSidebar();
  }, [setSelectedRightItem, toggleRightSidebar]);

  const handleConfidenceChange = useCallback((_event: Event, newValue: number | number[]) => {
    setConfidenceThreshold(newValue as number);
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Filter sample groups by the currently selected location + date
  // ─────────────────────────────────────────────────────────────────
  const samplesAtLocation = useMemo(() => {
    if (!selectedRightItem) return [];
    return Object.values(sampleGroups).filter((group: SampleGroupMetadata) => {
      if (group.loc_id !== selectedRightItem.id) return false;

      if (
          filters.selectedLocations.length > 0 &&
          !filters.selectedLocations.includes(group.loc_id)
      ) {
        return false;
      }

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
    });
  }, [selectedRightItem, sampleGroups, filters]);

  // Build a list of sample IDs
  const sampleIds = useMemo(() => {
    return samplesAtLocation.map(g => g.id);
  }, [samplesAtLocation]);

  // ─────────────────────────────────────────────────────────────────
  // 1) Query processed_data_improved for CTD / Nutrient / Sequence
  // Always call the same 3 hooks, never skip them.
  // ─────────────────────────────────────────────────────────────────
  const ctdDataQuery = useMemo(() => {
    // If sampleIds is empty, we use `1=0` to get no rows but keep the hook call
    return drizzleDB
        .select()
        .from(processed_data_improved)
        .where(
            and(
                eq(processed_data_improved.data_type, DataType.CTD),
                sampleIds.length
                    ? sql`sample_id IN (${sampleIds.join(',')})`
                    : eq(processed_data_improved.id, 'FALSE')
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
                    ? sql`sample_id IN (${sampleIds.join(',')})`
                    : eq(processed_data_improved.id, 'FALSE')
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
                    ? sql`sample_id IN (${sampleIds.join(',')})`
                    : eq(processed_data_improved.id, 'FALSE')
            )
        );
  }, [drizzleDB, sampleIds]);

  const ctdData = useQuery(toCompilableQuery(ctdDataQuery)).data || [];
  const nutrientData = useQuery(toCompilableQuery(nutrientDataQuery)).data || [];
  const sequenceData = useQuery(toCompilableQuery(sequenceDataQuery)).data || [];

  // ─────────────────────────────────────────────────────────────────
  // 2) Query detail tables (CTD, Nutrient, Kraken) using a single query
  //    per table, again always calling the same hooks.
  // ─────────────────────────────────────────────────────────────────
  const ctdIds = useMemo(() => ctdData.map(d => d.id), [ctdData]);
  const ctdDetailQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_ctd_rbr_data_values)
        .where(
            ctdIds.length
                ? sql`processed_data_id IN (${ctdIds.join(',')})`
                : eq(processed_ctd_rbr_data_values.processed_data_id, 'FALSE')
        );
  }, [drizzleDB, ctdIds]);
  const ctdDetailRows = useQuery(toCompilableQuery(ctdDetailQuery)).data || [];

  const nutrientIds = useMemo(() => nutrientData.map(d => d.id), [nutrientData]);
  const nutrientDetailQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_nutrient_ammonia_data)
        .where(
            nutrientIds.length
                ? sql`processed_data_id IN (${nutrientIds.join(',')})`
                : eq(processed_nutrient_ammonia_data.processed_data_id, 'FALSE')
        );
  }, [drizzleDB, nutrientIds]);
  const nutrientDetailRows = useQuery(toCompilableQuery(nutrientDetailQuery)).data || [];

  const sequenceIds = useMemo(() => sequenceData.map(d => d.id), [sequenceData]);
  const sequenceDetailQuery = useMemo(() => {
    return drizzleDB
        .select()
        .from(processed_kraken_uniq_report)
        .where(
            sequenceIds.length
                ? sql`processed_data_id IN (${sequenceIds.join(',')})`
                : eq(processed_kraken_uniq_report.processed_data_id, 'FALSE')
        );
  }, [drizzleDB, sequenceIds]);
  const sequenceDetailRows = useQuery(toCompilableQuery(sequenceDetailQuery)).data || [];

  // ─────────────────────────────────────────────────────────────────
  // 3) Compute stats in the frontend (average temp, average salinity,
  //    ammonium stats, sequence data by threshold).
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRightItem || sampleIds.length === 0) {
      setStats(initialStats);
      return;
    }

    // --------------------------
    // A) AVERAGE TEMP & SALINITY (depth <= 2 m)
    // --------------------------
    let totalTemp = 0;
    let tempCount = 0;
    let totalSalinity = 0;
    let salCount = 0;

    for (const row of ctdDetailRows) {
      if (row.depth != null && row.depth <= 2) {
        if (typeof row.temperature === 'number') {
          totalTemp += row.temperature;
          tempCount++;
        }
        if (typeof row.salinity === 'number') {
          totalSalinity += row.salinity;
          salCount++;
        }
      }
    }

    const average_temperature = tempCount > 0 ? totalTemp / tempCount : null;
    const average_salinity = salCount > 0 ? totalSalinity / salCount : null;

    // -----------------------------
    // B) AMMONIUM STATS (avg, min, max)
    // -----------------------------
    const ammoniumVals: number[] = [];
    for (const row of nutrientDetailRows) {
      if (typeof row.ammonium === 'number') {
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

    // --------------------------------
    // C) SEQUENCE DATA (species, genus), filtered by confidenceThreshold
    // --------------------------------
    const species_data: Record<string, number> = {};
    const genus_data: Record<string, number> = {};

    for (const row of sequenceDetailRows) {
      const percentage = row.percentage;
      if (typeof percentage !== 'number') continue;

      if (percentage > confidenceThreshold) {
        // If you want to track species (rank === 'S') vs. genus (rank === 'G'), etc.
        if (row.rank === 'S') {
          species_data[row.tax_name] = (species_data[row.tax_name] || 0) + 1;
        } else if (row.rank === 'G') {
          genus_data[row.tax_name] = (genus_data[row.tax_name] || 0) + 1;
        }
      }
    }

    // D) Update stats
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

  // ─────────────────────────────────────────────────────────────────
  // 4) Render
  // ─────────────────────────────────────────────────────────────────
  // If no selected item, render an empty/fallback UI (but do NOT skip hooks above)
  if (!selectedRightItem) {
    return (
        <div className="right-sidebar collapsed">
          {/* Optional: a placeholder or message */}
        </div>
    );
  }

  return (
      <div className={`right-sidebar ${isRightSidebarCollapsed ? 'collapsed' : ''}`}>
        <IconButton
            onClick={handleClose}
            aria-label="Close Sidebar"
            sx={styles.closeButton}
        >
          <CloseIcon />
        </IconButton>

        <Box sx={styles.contentBox}>
          <Typography variant="h5" gutterBottom>
            {selectedRightItem.label}
          </Typography>

          <Typography variant="body1" gutterBottom>
            <strong>Location ID:</strong> {selectedRightItem.char_id}
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Latitude:</strong> {selectedRightItem.lat}
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Longitude:</strong> {selectedRightItem.long}
          </Typography>

          <Divider sx={styles.divider} />

          {/* Confidence Threshold Slider */}
          <Card sx={styles.sliderCard}>
            <CardContent sx={styles.cardContent}>
              <Typography variant="h6" gutterBottom>
                Sequence Abundance Threshold
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                    value={confidenceThreshold}
                    onChange={handleConfidenceChange}
                    aria-labelledby="confidence-threshold-slider"
                    valueLabelDisplay="auto"
                    step={5}
                    marks
                    min={0}
                    max={100}
                />
                <Typography variant="body2" color="text.secondary" align="center">
                  Showing taxa with {'>'}{confidenceThreshold}% inter-sample read abundance
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Temperature and Salinity Card */}
          {(stats.average_temperature !== null || stats.average_salinity !== null) && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Average Measurements (First 2 Meters)
                  </Typography>
                  {stats.average_temperature !== null ? (
                      <Typography variant="body1" gutterBottom>
                        <strong>Temperature:</strong> {stats.average_temperature.toFixed(2)} °C
                      </Typography>
                  ) : (
                      <Typography variant="body1" gutterBottom>
                        Temperature data not available for the first 2 meters.
                      </Typography>
                  )}
                  {stats.average_salinity !== null ? (
                      <Typography variant="body1" gutterBottom>
                        <strong>Salinity:</strong> {stats.average_salinity.toFixed(2)} PSU
                      </Typography>
                  ) : (
                      <Typography variant="body1" gutterBottom>
                        Salinity data not available for the first 2 meters.
                      </Typography>
                  )}
                </CardContent>
              </Card>
          )}

          {/* Ammonium Stats Card */}
          {stats.ammonium_stats.count > 0 && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Ammonium Measurements
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" gutterBottom>
                        <strong>Average:</strong>{' '}
                        {stats.ammonium_stats.average?.toFixed(2)} µmol/L
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        <strong>Minimum:</strong>{' '}
                        {stats.ammonium_stats.min?.toFixed(2)} µmol/L
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" gutterBottom>
                        <strong>Maximum:</strong>{' '}
                        {stats.ammonium_stats.max?.toFixed(2)} µmol/L
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        <strong>Samples:</strong> {stats.ammonium_stats.count}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
          )}

          {/* Species Data Card */}
          {Object.keys(stats.species_data).length > 0 && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Species Identified
                  </Typography>
                  <Grid container spacing={1}>
                    {Object.entries(stats.species_data)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 100) // Show top 100 if desired
                        .map(([species, count]) => (
                            <Grid item xs={12} key={species}>
                              <Typography variant="body1">
                                <strong>{species}</strong>: {count} sample(s)
                              </Typography>
                            </Grid>
                        ))}
                  </Grid>
                </CardContent>
              </Card>
          )}

          {/* Optionally render Genera if desired */}
          {/* {Object.keys(stats.genus_data).length > 0 && (
          <Card sx={styles.card}>
            <CardContent sx={styles.cardContent}>
              <Typography variant="h6" gutterBottom>
                Genera Identified
              </Typography>
              <Grid container spacing={1}>
                {Object.entries(stats.genus_data)
                  .sort(([, a], [, b]) => b - a)
                  .map(([genus, count]) => (
                    <Grid item xs={12} key={genus}>
                      <Typography variant="body1">
                        <strong>{genus}</strong>: {count} sample(s)
                      </Typography>
                    </Grid>
                  ))}
              </Grid>
            </CardContent>
          </Card>
        )} */}

          {/* Samples List Card */}
          {samplesAtLocation.length > 0 && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Samples at this Location
                  </Typography>
                  <Grid container spacing={2}>
                    {samplesAtLocation.map((sampleGroup) => (
                        <Grid item xs={12} key={sampleGroup.id}>
                          <Typography variant="body1">
                            <strong>{sampleGroup.human_readable_sample_id}</strong>
                          </Typography>
                          {sampleGroup.collection_date && (
                              <Typography variant="body2" color="text.secondary">
                                {DateTime.fromISO(sampleGroup.collection_date).toLocaleString(
                                    DateTime.DATE_MED
                                )}
                              </Typography>
                          )}
                        </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
          )}
        </Box>
      </div>
  );
};

export default RightSidebar;
