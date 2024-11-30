// src/components/RightSidebar.tsx

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

import { useData, useUI } from '../lib/hooks';
import { useProcessedData } from '../lib/hooks';
import type { SampleGroupMetadata } from '../lib/types';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

// Import the processKrakenDataForModal function
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

const RightSidebar: React.FC = () => {
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

  const styles = useMemo(
      (): Record<string, SxProps<Theme>> => ({
        closeButton: {
          position: 'absolute',
          top: '15px',
          left: '15px',
          color: 'common.white',
          backgroundColor: 'transparent',
          boxShadow: 'none',
          '&:hover': {
            color: 'primary.main',
          },
        },
        contentBox: {
          padding: 2,
          overflowY: 'auto',
          height: '100%',
        },
        card: {
          mb: 2,
        },
        divider: {
          my: 2,
        },
      }),
      []
  );

  const closeSidebar = useCallback(() => {
    setSelectedRightItem(null);
    toggleRightSidebar(true);
  }, [setSelectedRightItem, toggleRightSidebar]);

  // Filter samples based on selected location and filters
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

      if (filters.startDate || filters.endDate) {
        if (!group.collection_date) return false;

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

  // Fetch processed data for each sample
  useEffect(() => {
    samplesAtLocation.forEach((sampleGroup) => {
      fetchProcessedData(sampleGroup);
    });
  }, [samplesAtLocation, fetchProcessedData]);

  // Process CTD data for a specific sample
  const processCTDData = useCallback((_sampleId: string, data: any) => {
    data = data[0];
    const channelMap: Record<string, string> = {};
    data.channels.forEach((channel: any) => {
      channelMap[channel.long_name] = `channel${String(channel.channel_id).padStart(
          2,
          '0'
      )}`;
    });

    let tempSum = 0,
        tempCount = 0;
    let salSum = 0,
        salCount = 0;

    data.data.forEach((point: any) => {
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

    let tempSum = 0,
        tempCount = 0;
    let salSum = 0,
        salCount = 0;
    let totalAmm = 0,
        ammCount = 0;
    let minAmm: number | null = null,
        maxAmm: number | null = null;
    const speciesSet: Record<string, Set<string>> = {};
    const genusSet: Record<string, Set<string>> = {};

    samplesAtLocation.forEach((group) => {
      const sampleId = group.id; // sample ID

      // Get CTD data
      const ctdKey = `${sampleId}:ctd_data`;
      const ctdData = processedData[ctdKey];
      if (ctdData) {
        const processed = processCTDData(sampleId, ctdData);
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

      // Get nutrient data
      const nutrientKey = `${sampleId}:nutrient_ammonia`;
      const nutrientArray = processedData[nutrientKey];
      if (nutrientArray) {
        const nutrientData = nutrientArray[0];
        if (nutrientData?.ammonium_value != null) {
          const ammValue = nutrientData.ammonium_value;
          totalAmm += ammValue;
          ammCount++;
          minAmm = minAmm === null ? ammValue : Math.min(minAmm, ammValue);
          maxAmm = maxAmm === null ? ammValue : Math.max(maxAmm, ammValue);
        }
      }

      // Get sequencing data
      const seqKey = `${sampleId}:sequencing_data`;
      const seqData = processedData[seqKey];
      if (seqData) {
        try {
          // Process the Kraken sequencing data
          const krakenData = processKrakenDataForModal(seqData.report_content);
          if (krakenData && Array.isArray(krakenData.data)) {
            krakenData.data.forEach((rankData) => {
              const rank = rankData.rankBase.toUpperCase();
              if (rank === 'SPECIES' || rank === 'GENUS') {
                rankData.plotData.forEach((item) => {
                  const taxName = item.taxon;
                  if (taxName) {
                    if (rank === 'SPECIES') {
                      if (!speciesSet[taxName]) speciesSet[taxName] = new Set();
                      speciesSet[taxName].add(sampleId);
                    } else if (rank === 'GENUS') {
                      if (!genusSet[taxName]) genusSet[taxName] = new Set();
                      genusSet[taxName].add(sampleId);
                    }
                  }
                });
              }
            });
          }
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
  }, [selectedRightItem, samplesAtLocation, processedData, processCTDData]);

  if (!selectedRightItem) return null;

  return (
      <div className={`right-sidebar ${isRightSidebarCollapsed ? 'collapsed' : ''}`}>
        <IconButton
            onClick={closeSidebar}
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
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Average Measurements (First 2 Meters)
                  </Typography>
                  {stats.averageTemperature !== null ? (
                      <Typography variant="body1" gutterBottom>
                        <strong>Temperature:</strong>{' '}
                        {stats.averageTemperature.toFixed(2)} °C
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
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ammonium Measurements
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Average Ammonium:</strong>{' '}
                    {stats.ammoniumStats.average?.toFixed(2)} µmol/L
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Minimum Ammonium:</strong>{' '}
                    {stats.ammoniumStats.min?.toFixed(2)} µmol/L
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Maximum Ammonium:</strong>{' '}
                    {stats.ammoniumStats.max?.toFixed(2)} µmol/L
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Number of Samples:</strong> {stats.ammoniumStats.count}
                  </Typography>
                </CardContent>
              </Card>
          )}

          {/* Species Data Card */}
          {Object.keys(stats.speciesData).length > 0 && (
              <Card sx={styles.card}>
                <CardContent>
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
                <CardContent>
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
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Samples at this Location
                  </Typography>
                  <ul style={{ paddingLeft: '1.2em' }}>
                    {samplesAtLocation.map((sampleGroup) => (
                        <li key={sampleGroup.id}>
                          <Typography variant="body1">
                            <strong>{sampleGroup.human_readable_sample_id}</strong> (Sample
                            ID: {sampleGroup.id})
                          </Typography>
                          {sampleGroup.collection_date && (
                              <Typography variant="body2" color="text.secondary">
                                Sample Date:{' '}
                                {DateTime.fromISO(sampleGroup.collection_date).toLocaleString(
                                    DateTime.DATE_MED
                                )}
                              </Typography>
                          )}
                        </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
          )}
        </Box>
      </div>
  );
};

export default RightSidebar;
