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
import { invoke } from '@tauri-apps/api/core';

import { useUI, useData } from '../lib/hooks';
import type { SampleGroupMetadata } from '../lib/types';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { useQuery } from "@powersync/react";

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

  // Styles
  const styles = useMemo((): Record<string, SxProps<Theme>> => ({
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
  }), []);

  const handleClose = useCallback(() => {
    setSelectedRightItem(null);
    toggleRightSidebar();
  }, [setSelectedRightItem, toggleRightSidebar]);

  const handleConfidenceChange = useCallback((_event: Event, newValue: number | number[]) => {
    setConfidenceThreshold(newValue as number);
  }, []);

  // Filter samples based on location and date filters
  const samplesAtLocation = useMemo(() => {
    if (!selectedRightItem) return [];
    return Object.values(sampleGroups).filter((group: SampleGroupMetadata) => {
      if (group.loc_id !== selectedRightItem.id) return false;

      if (filters.selectedLocations.length > 0 &&
          !filters.selectedLocations.includes(group.loc_id)) {
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
  const sampleIds = useMemo(() => samplesAtLocation.map(g => g.id), [samplesAtLocation]);

  // Define query for processed data using useQuery
  const { data: rawResults = [] } = useQuery(
      sampleIds.length > 0
          ? `
            SELECT * FROM processed_data
            WHERE sample_id IN (${sampleIds.map(() => '?').join(', ')})
              AND status = 'completed'
            ORDER BY timestamp DESC
          `
          : 'SELECT * FROM processed_data WHERE 1=0',
      sampleIds
  );

  // Process the raw results
  const processedData = useMemo(() => {
    const dataMap: Record<string, any> = {};
    for (const result of rawResults) {
      const key = `${result.sample_id}:${result.config_id}`;
      dataMap[key] = {
        ...result,
        data: result.data ? JSON.parse(result.data) : null,
        metadata: result.metadata ? JSON.parse(result.metadata) : null,
        raw_file_paths: result.raw_file_paths ? JSON.parse(result.raw_file_paths) : null,
        processed_file_paths: result.processed_file_paths ? JSON.parse(result.processed_file_paths) : null,
      };
    }
    return dataMap;
  }, [rawResults]);

// Update statistics using Tauri command
  useEffect(() => {
    const updateStats = async () => {
      if (!selectedRightItem || samplesAtLocation.length === 0) {
        setStats(initialStats);
        return;
      }

      try {
        // Create request object matching Rust struct expectations
        const request = {
          sample_groups: samplesAtLocation.map(group => ({
            id: group.id,
            loc_id: group.loc_id,
          })),
          processed_data: Object.fromEntries(
              Object.entries(processedData).map(([key, value]) => [
                key,
                {
                  sample_id: value.sample_id,
                  config_id: value.config_id,
                  status: value.status,
                  data: value.data,
                  metadata: value.metadata,
                  raw_file_paths: value.raw_file_paths,
                  processed_file_paths: value.processed_file_paths,
                }
              ])
          ),
          confidence_threshold: confidenceThreshold,
        };

        const result = await invoke<ProcessedStats>('process_sidebar_stats', {
          request // Wrap the request object in an outer object
        });
        setStats(result);
      } catch (error) {
        console.error('Error processing stats:', error);
        setStats(initialStats);
      }
    };

    updateStats();
  }, [selectedRightItem, samplesAtLocation, processedData, confidenceThreshold]);

  if (!selectedRightItem) return null;

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
                Sequence Confidence Threshold
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
                        <strong>Average:</strong> {stats.ammonium_stats.average?.toFixed(2)} µmol/L
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        <strong>Minimum:</strong> {stats.ammonium_stats.min?.toFixed(2)} µmol/L
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" gutterBottom>
                        <strong>Maximum:</strong> {stats.ammonium_stats.max?.toFixed(2)} µmol/L
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
                        .slice(0, 100)
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

          {/* Genus Data Card */}
          {Object.keys(stats.genus_data).length > 0 && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Genera Identified
                  </Typography>
                  <Grid container spacing={1}>
                    {Object.entries(stats.genus_data)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 100)
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
          )}

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
                                {DateTime.fromISO(sampleGroup.collection_date).toLocaleString(DateTime.DATE_MED)}
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