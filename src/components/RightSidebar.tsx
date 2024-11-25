// src/renderer/components/RightSidebar.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { DateTime } from 'luxon'; // For date comparisons
import useUI from '../hooks/useUI';
import useData from '../hooks/useData';
import { SampleGroup } from '../utils/sampleGroupUtils';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
} from '@mui/material';
import useProcessedData from "../hooks/useProcessedData.ts";

const RightSidebar: React.FC = () => {
  const {
    selectedRightItem,
    setSelectedRightItem,
    isRightSidebarCollapsed,
    closeRightSidebar,
    filters,
  } = useUI();
  const { sampleGroupData } = useData();
  const { processedData, fetchProcessedData } = useProcessedData()

  const [averageTemperature, setAverageTemperature] = useState<number | null>(
    null,
  );
  const [averageSalinity, setAverageSalinity] = useState<number | null>(null);

  const [ammoniumStats, setAmmoniumStats] = useState<{
    average: number | null;
    min: number | null;
    max: number | null;
    count: number;
  }>({ average: null, min: null, max: null, count: 0 });

  const [speciesData, setSpeciesData] = useState<{ [name: string]: number }>({});
  const [genusData, setGenusData] = useState<{ [name: string]: number }>({});

  const closeSidebar = useCallback(() => {
    setSelectedRightItem(null);
    closeRightSidebar();
    console.log('Sidebar closed.');
  }, [setSelectedRightItem, closeRightSidebar]);

  useEffect(() => {
    if (selectedRightItem && !isRightSidebarCollapsed) {
      console.log('RightSidebar is now visible.');
    }
  }, [selectedRightItem, isRightSidebarCollapsed]);

  // Filter samples based on selected location and filters
  const samplesAtLocation = useMemo(() => {
    if (!selectedRightItem) return [];

    return Object.values(sampleGroupData).filter((group) => {
      // Ensure the sample belongs to the selected location
      if (group.loc_id !== selectedRightItem.id) return false;

      // Apply location-based filters if necessary
      if (
        filters.selectedLocations.length > 0 &&
        !filters.selectedLocations.includes(group.loc_id)
      ) {
        return false;
      }

      // Apply date-based filters
      if (filters.startDate || filters.endDate) {
        if (!group.collection_date) return false; // Exclude if no date information

        const sampleDate = DateTime.fromISO(group.collection_date);
        if (filters.startDate) {
          const startDate = DateTime.fromISO(filters.startDate);
          if (sampleDate < startDate) return false;
        }
        if (filters.endDate) {
          const endDate = DateTime.fromISO(filters.endDate);
          if (sampleDate > endDate) return false;
        }
      }

      return true;
    });
  }, [selectedRightItem, sampleGroupData, filters]);

  // Fetch processed data for samples at this location
  useEffect(() => {
    samplesAtLocation.forEach((sampleGroup: SampleGroup) => {
      fetchProcessedData(sampleGroup);
    });
  }, [samplesAtLocation, fetchProcessedData]);

  // Compute statistics based on filtered samples
  useEffect(() => {
    if (!selectedRightItem) {
      setAverageTemperature(null);
      setAverageSalinity(null);
      setAmmoniumStats({ average: null, min: null, max: null, count: 0 });
      setSpeciesData({});
      setGenusData({});
      return;
    }

    const computeStatistics = () => {
      let totalTemperature = 0;
      let totalSalinity = 0;
      let temperatureCount = 0;
      let salinityCount = 0;

      let totalAmmonium = 0;
      let ammoniumCount = 0;
      let minAmmonium: number | null = null;
      let maxAmmonium: number | null = null;

      const speciesSet: { [name: string]: Set<string> } = {};
      const genusSet: { [name: string]: Set<string> } = {};

      samplesAtLocation.forEach((sampleGroup: SampleGroup) => {
        const sampleId = sampleGroup.human_readable_sample_id;

        // Process CTD data
        const ctdDataItem = processedData[`${sampleId}:ctd_data`];
        const ctdData = ctdDataItem?.data;
        if (ctdData) {
          const channelsArray = ctdData.channels;
          const dataArray = ctdData.data;

          // Ensure both channels and data arrays are available
          if (channelsArray && Array.isArray(dataArray)) {
            // Build a mapping from longName to channel key
            const longNameToChannelKey: { [key: string]: string } = {};
            channelsArray.forEach((channel: any) => {
              const { channelID } = channel;
              const { longName } = channel;
              // Format the channel key, e.g., channel02
              const channelKey = `channel${String(channelID).padStart(2, '0')}`;
              longNameToChannelKey[longName] = channelKey;
            });

            const temperatureKey = longNameToChannelKey.Temperature;
            const salinityKey = longNameToChannelKey.Salinity;
            const depthKey = longNameToChannelKey.Depth;

            // Check if the necessary keys exist
            if (!depthKey) {
              // Cannot compute averages for the first 2 meters without depth data
              console.warn('Depth data not available.');
            } else {
              dataArray.forEach((dataPoint: any) => {
                const depthValue = dataPoint[depthKey];
                if (
                  depthValue != null &&
                  !isNaN(depthValue) &&
                  depthValue <= 2
                ) {
                  if (temperatureKey) {
                    const tempValue = dataPoint[temperatureKey];
                    if (tempValue != null && !isNaN(tempValue)) {
                      totalTemperature += tempValue;
                      temperatureCount += 1;
                    }
                  }
                  if (salinityKey) {
                    const salValue = dataPoint[salinityKey];
                    if (salValue != null && !isNaN(salValue)) {
                      totalSalinity += salValue;
                      salinityCount += 1;
                    }
                  }
                }
              });
            }
          }
        }

        // Process nutrient data
        const nutrientProcessedData =
          processedData[`${sampleId}:nutrient_ammonia`];
        if (nutrientProcessedData && nutrientProcessedData.data) {
          const dataPoint = nutrientProcessedData.data;
          const ammoniumValue = dataPoint.ammoniumValue; // Adjust according to actual data structure
          if (ammoniumValue != null && !isNaN(ammoniumValue)) {
            totalAmmonium += ammoniumValue;
            ammoniumCount += 1;
            if (minAmmonium === null || ammoniumValue < minAmmonium) {
              minAmmonium = ammoniumValue;
            }
            if (maxAmmonium === null || ammoniumValue > maxAmmonium) {
              maxAmmonium = ammoniumValue;
            }
          }
        }

        // Process classification data
        const classificationProcessedData =
          processedData[`${sampleId}:sequencing_data`];
        if (classificationProcessedData && classificationProcessedData.data) {
          const sampleSpecies = new Set<string>();
          const sampleGenera = new Set<string>();

          classificationProcessedData.data.forEach((entry: any) => {
            const taxName = entry.name || entry.taxonName;
            const rank = entry.rank || entry.rankCode;

            if (taxName && rank) {
              if (rank.toLowerCase() === 'species') {
                sampleSpecies.add(taxName);
              } else if (rank.toLowerCase() === 'genus') {
                sampleGenera.add(taxName);
              }
            }
          });

          // Update species counts
          sampleSpecies.forEach((species) => {
            if (!speciesSet[species]) {
              speciesSet[species] = new Set();
            }
            speciesSet[species].add(sampleId);
          });

          // Update genus counts
          sampleGenera.forEach((genus) => {
            if (!genusSet[genus]) {
              genusSet[genus] = new Set();
            }
            genusSet[genus].add(sampleId);
          });
        }
      });

      const avgTemp =
        temperatureCount > 0 ? totalTemperature / temperatureCount : null;
      const avgSal =
        salinityCount > 0 ? totalSalinity / salinityCount : null;

      setAverageTemperature(avgTemp);
      setAverageSalinity(avgSal);

      const avgAmmonium =
        ammoniumCount > 0 ? totalAmmonium / ammoniumCount : null;

      setAmmoniumStats({
        average: avgAmmonium,
        min: minAmmonium,
        max: maxAmmonium,
        count: ammoniumCount,
      });

      // Convert speciesSet and genusSet to count of samples
      const speciesCounts: { [name: string]: number } = {};
      Object.entries(speciesSet).forEach(([species, sampleIds]) => {
        speciesCounts[species] = sampleIds.size;
      });
      setSpeciesData(speciesCounts);

      const genusCounts: { [name: string]: number } = {};
      Object.entries(genusSet).forEach(([genus, sampleIds]) => {
        genusCounts[genus] = sampleIds.size;
      });
      setGenusData(genusCounts);
    };

    computeStatistics();
  }, [selectedRightItem, samplesAtLocation, processedData]);

  if (!selectedRightItem) {
    return null;
  }

  return (
    <div
      className={`right-sidebar ${isRightSidebarCollapsed ? 'collapsed' : ''}`}
    >
      <IconButton
        className="right-sidebar__close-button"
        onClick={closeSidebar}
        aria-label="Close Sidebar"
        sx={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          color: 'var(--color-white)',
          backgroundColor: 'transparent',
          boxShadow: 'none',
          '&:hover': {
            color: 'var(--color-primary)',
          },
        }}
      >
        <CloseIcon />
      </IconButton>

      <Box
        sx={{
          padding: 2,
          overflowY: 'auto',
          height: '100%',
        }}
      >
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

        <Divider sx={{ my: 2 }} />

        {/* Display average temperature and salinity if available */}
        {(averageTemperature !== null || averageSalinity !== null) && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Average Measurements (First 2 Meters)
              </Typography>
              {averageTemperature !== null ? (
                <Typography variant="body1" gutterBottom>
                  <strong>Temperature:</strong>{' '}
                  {averageTemperature.toFixed(2)} °C
                </Typography>
              ) : (
                <Typography variant="body1" gutterBottom>
                  Temperature data not available for the first 2 meters.
                </Typography>
              )}
              {averageSalinity !== null ? (
                <Typography variant="body1" gutterBottom>
                  <strong>Salinity:</strong> {averageSalinity.toFixed(2)} PSU
                </Typography>
              ) : (
                <Typography variant="body1" gutterBottom>
                  Salinity data not available for the first 2 meters.
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Display ammonium stats if available */}
        {ammoniumStats.count > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ammonium Measurements
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Average Ammonium:</strong>{' '}
                {ammoniumStats.average?.toFixed(2)} µmol/L
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Minimum Ammonium:</strong>{' '}
                {ammoniumStats.min?.toFixed(2)} µmol/L
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Maximum Ammonium:</strong>{' '}
                {ammoniumStats.max?.toFixed(2)} µmol/L
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Number of Samples:</strong> {ammoniumStats.count}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Display species data if available */}
        {Object.keys(speciesData).length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Species Identified
              </Typography>
              <Grid container spacing={1}>
                {Object.entries(speciesData)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10) // Display top 10 species
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

        {/* Display genus data if available */}
        {Object.keys(genusData).length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Genera Identified
              </Typography>
              <Grid container spacing={1}>
                {Object.entries(genusData)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10) // Display top 10 genera
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

        {/* Display samples at this location */}
        {samplesAtLocation.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Samples at this Location
              </Typography>
              <ul style={{ paddingLeft: '1.2em' }}>
                {samplesAtLocation.map((sampleGroup) => (
                  <li key={sampleGroup.id}>
                    <Typography variant="body1">
                      <strong>{sampleGroup.name}</strong> (Sample ID:{' '}
                      {sampleGroup.id})
                    </Typography>
                    {sampleGroup.collection_date && (
                      <Typography variant="body2" color="textSecondary">
                        Sample Date:{' '}
                        {DateTime.fromISO(sampleGroup.collection_date).toLocaleString(
                          DateTime.DATE_MED,
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
