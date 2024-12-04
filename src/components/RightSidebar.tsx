import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DateTime } from 'luxon';

import { useUI, useData, useProcessedData } from '../lib/hooks';
import type { SampleGroupMetadata } from '../lib/types';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

import { processKrakenDataForModal } from '../lib/utils/dataProcessingUtils';

interface DataStats {
  averageTemperature: number | null;
  averageSalinity: number | null;
  ammoniumStats: {
    average: number | null;
    min: number | null;
    max: number | null;
    count: number;
  };
  speciesData: Record<string, number>;
  genusData: Record<string, number>;
}

const initialDataStats: DataStats = {
  averageTemperature: null,
  averageSalinity: null,
  ammoniumStats: { average: null, min: null, max: null, count: 0 },
  speciesData: {},
  genusData: {},
};

export const RightSidebar: React.FC = () => {
  const {
    selectedRightItem,
    setSelectedRightItem,
    isRightSidebarCollapsed,
    toggleRightSidebar,
    filters,
  } = useUI();

  const { sampleGroups } = useData();
  const { processedData, fetchProcessedData } = useProcessedData();
  const [stats, setStats] = useState<DataStats>(initialDataStats);

  // Memoized styles using theme
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
    divider: {
      my: 2,
    },
    cardContent: {
      '&:last-child': {
        pb: 2,
      },
    },
  }), []);

  // Handle sidebar close
  const handleClose = useCallback(() => {
    setSelectedRightItem(null);
    toggleRightSidebar(true);
  }, [setSelectedRightItem, toggleRightSidebar]);

  // Filter samples based on location and date filters
  const samplesAtLocation = useMemo(() => {
    if (!selectedRightItem) return [];

    return Object.values(sampleGroups).filter((group: SampleGroupMetadata) => {
      // Check location match
      if (group.loc_id !== selectedRightItem.id) return false;

      // Apply location filters
      if (filters.selectedLocations.length > 0 &&
          !filters.selectedLocations.includes(group.loc_id)) {
        return false;
      }

      // Apply date filters
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

  // Fetch processed data for samples
  useEffect(() => {
    samplesAtLocation.forEach(sampleGroup => {
      fetchProcessedData(sampleGroup);
    });
  }, [samplesAtLocation, fetchProcessedData]);

  // Process CTD data
  const processCTDData = useCallback((data: any) => {
    data = data.data;
    const channelMap: Record<string, string> = {};
    data[0].channels.forEach((channel: any) => {
      channelMap[channel.long_name] = `channel${String(channel.channel_id).padStart(2, '0')}`;
    });

    let tempSum = 0, tempCount = 0;
    let salSum = 0, salCount = 0;

    data[0].data.forEach((point: any) => {
      const depth = point[channelMap['Depth']];
      if (depth != null && depth <= 2) {
        if (channelMap['Temperature']) {
          const temp = point[channelMap['Temperature']];
          if (temp != null && !isNaN(temp)) {
            tempSum += temp;
            tempCount++;
          }
        }
        if (channelMap['Salinity']) {
          const sal = point[channelMap['Salinity']];
          if (sal != null && !isNaN(sal)) {
            salSum += sal;
            salCount++;
          }
        }
      }
    });

    return {
      temperature: tempCount > 0 ? tempSum / tempCount : null,
      salinity: salCount > 0 ? salSum / salCount : null,
    };
  }, []);

  // Update statistics based on processed data
  useEffect(() => {
    if (!selectedRightItem) {
      setStats(initialDataStats);
      return;
    }

    const processStats = () => {
      let tempSum = 0, tempCount = 0;
      let salSum = 0, salCount = 0;
      let totalAmm = 0, ammCount = 0;
      let minAmm: number | null = null;
      let maxAmm: number | null = null;
      const speciesSet: Record<string, Set<string>> = {};
      const genusSet: Record<string, Set<string>> = {};

      samplesAtLocation.forEach(group => {
        const sampleId = group.id;

        // Process CTD data
        const ctdKey = `${sampleId}:ctd_data`;
        if (processedData[ctdKey]) {
          const processed = processCTDData(processedData[ctdKey]);
          if (processed) {
            if (processed.temperature !== null) {
              tempSum += processed.temperature;
              tempCount++;
            }
            if (processed.salinity !== null) {
              salSum += processed.salinity;
              salCount++;
            }
          }
        }

        // Process nutrient data
        const nutrientKey = `${sampleId}:nutrient_ammonia`;
        const nutrientData = processedData[nutrientKey]?.data[0];
        if (nutrientData?.ammonium_value != null) {
          const ammValue = nutrientData.ammonium_value;
          totalAmm += ammValue;
          ammCount++;
          minAmm = minAmm === null ? ammValue : Math.min(minAmm, ammValue);
          maxAmm = maxAmm === null ? ammValue : Math.max(maxAmm, ammValue);
        }

        // Process sequencing data
        const seqKey = `${sampleId}:sequencing_data`;
        if (processedData[seqKey]) {
          console.log(processedData[seqKey]);
          try {
            const krakenData = processKrakenDataForModal(processedData[seqKey].data.report_content);
            krakenData.data?.forEach(rankData => {
              const rank = rankData.rankBase.toUpperCase();
              if (rank === 'SPECIES' || rank === 'GENUS') {
                rankData.plotData?.forEach(item => {
                  if (item.taxon) {
                    const set = rank === 'SPECIES' ? speciesSet : genusSet;
                    if (!set[item.taxon]) set[item.taxon] = new Set();
                    set[item.taxon].add(sampleId);
                  }
                });
              }
            });
          } catch (error) {
            console.error('Error processing sequencing data:', error);
          }
        }
      });

      setStats({
        averageTemperature: tempCount > 0 ? tempSum / tempCount : null,
        averageSalinity: salCount > 0 ? salSum / salCount : null,
        ammoniumStats: {
          average: ammCount > 0 ? totalAmm / ammCount : null,
          min: minAmm,
          max: maxAmm,
          count: ammCount,
        },
        speciesData: Object.fromEntries(
            Object.entries(speciesSet).map(([name, samples]) => [name, samples.size])
        ),
        genusData: Object.fromEntries(
            Object.entries(genusSet).map(([name, samples]) => [name, samples.size])
        ),
      });
    };

    processStats();
  }, [selectedRightItem, samplesAtLocation, processedData, processCTDData]);

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

          {/* Temperature and Salinity Card */}
          {(stats.averageTemperature !== null || stats.averageSalinity !== null) && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Average Measurements (First 2 Meters)
                  </Typography>
                  {stats.averageTemperature !== null ? (
                      <Typography variant="body1" gutterBottom>
                        <strong>Temperature:</strong> {stats.averageTemperature.toFixed(2)} °C
                      </Typography>
                  ) : (
                      <Typography variant="body1" gutterBottom>
                        Temperature data not available for the first 2 meters.
                      </Typography>
                  )}
                  {stats.averageSalinity !== null ? (
                      <Typography variant="body1" gutterBottom>
                        <strong>Salinity:</strong> {stats.averageSalinity.toFixed(2)} PSU
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
          {stats.ammoniumStats.count > 0 && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Ammonium Measurements
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" gutterBottom>
                        <strong>Average:</strong> {stats.ammoniumStats.average?.toFixed(2)} µmol/L
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        <strong>Minimum:</strong> {stats.ammoniumStats.min?.toFixed(2)} µmol/L
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" gutterBottom>
                        <strong>Maximum:</strong> {stats.ammoniumStats.max?.toFixed(2)} µmol/L
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        <strong>Samples:</strong> {stats.ammoniumStats.count}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
          )}

          {/* Species Data Card */}
          {Object.keys(stats.speciesData).length > 0 && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Species Identified
                  </Typography>
                  <Grid container spacing={1}>
                    {Object.entries(stats.speciesData)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10)
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
          {Object.keys(stats.genusData).length > 0 && (
              <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                  <Typography variant="h6" gutterBottom>
                    Genera Identified
                  </Typography>
                  <Grid container spacing={1}>
                    {Object.entries(stats.genusData)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10)
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