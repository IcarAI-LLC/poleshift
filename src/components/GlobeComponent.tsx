import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { DateTime } from 'luxon';
import globeImage from '../assets/globe.jpg';
import { useData } from '../lib/hooks/useData';
import { useUI } from '../lib/hooks/useUI';
import { useQuery } from '@powersync/react';
import useSettings from "../lib/hooks/useSettings";

interface GlobePoint {
    lat: number;
    lng: number;
    name: string;
    id: string;
}

// Our defaults
const GLOBE_CONFIG = {
    pointAltitude: 10,
    pointRadius: 0.1,
    pointColor: 'rgba(0, 255, 255, 0.8)',
    backgroundColor: '#000000',
    transitionDuration: 1000,
    defaultAltitude: 0.5,
} as const;

export const GlobeComponent: React.FC = () => {
    // 1) Load user settings from your custom hook
    const { userSettings, userSettingsArray } = useSettings();

    // For simplicity, we’ll just grab the first row. In a real app,
    // you may want to pick the row that matches the current user_id.
    const firstUserSetting = userSettingsArray[0] || null;

    // 2) Derive your custom “globe config” from user settings if available
    //    or fall back to your GLOBE_CONFIG defaults.
    const userGlobeColor = firstUserSetting?.globe_datapoint_color ?? GLOBE_CONFIG.pointColor;
    const userGlobeDiameter = parseFloat(firstUserSetting?.globe_datapoint_diameter ?? String(GLOBE_CONFIG.pointRadius));

    // “globe_datapoint_poles” is an integer in your schema;
    // you can map it to altitude, or even ignore it if you just want to store it for something else.
    // Here, we’re dividing by 100 to keep altitude small.
    const userGlobeAltitude = firstUserSetting
        ? firstUserSetting.globe_datapoint_poles
            ? 0.1
            : 0
        : 0;

    // 3) Create a single config object with final values
    const finalGlobeConfig = {
        ...GLOBE_CONFIG,
        pointAltitude: userGlobeAltitude,
        pointRadius: userGlobeDiameter,
        pointColor: () => userGlobeColor,
    };

    // 4) (Keep the rest of your existing logic the same.)
    const globeRef = useRef<GlobeMethods | undefined>(undefined);
    const { filters, setSelectedRightItem } = useUI();

    // Build your filtered query
    const { query: filteredLocationsQuery, params: filteredLocationsParams } = useMemo(() => {
        let query = `
      SELECT DISTINCT sl.id, sl.lat, sl.long, sl.label
      FROM sample_locations sl
      WHERE sl.is_enabled = 1
    `;
        const params: any[] = [];

        if (filters.selectedLocations.length > 0) {
            const placeholders = filters.selectedLocations.map(() => '?').join(', ');
            query += ` AND sl.id IN (${placeholders})`;
            params.push(...filters.selectedLocations);
        }

        if (filters.startDate || filters.endDate) {
            query += `
        AND EXISTS (
          SELECT 1 FROM sample_group_metadata sg
          WHERE sg.loc_id = sl.id
      `;
            if (filters.startDate) {
                query += ` AND sg.collection_date >= ?`;
                params.push(filters.startDate);
            }
            if (filters.endDate) {
                query += ` AND sg.collection_date <= ?`;
                params.push(filters.endDate);
            }
            query += `)
      `;
        }

        query += ' ORDER BY sl.label ASC';

        return { query, params };
    }, [filters]);

    // Execute the query
    const {
        data: filteredLocations = [],
        isLoading: locationsLoading,
        error: locationsError
    } = useQuery(filteredLocationsQuery, filteredLocationsParams);

    // Bring in sampleGroups
    const { sampleGroups } = useData();

    // Transform filtered locations into globe points
    const pointsData = useMemo<GlobePoint[]>(() => {
        return filteredLocations
            .map(location => {
                if (location?.lat != null && location?.long != null) {
                    const locationSamples = Object.values(sampleGroups)
                        .filter(group => group.loc_id === location.id)
                        .filter(group => {
                            if (!group.collection_date) return true;
                            const sampleDate = DateTime.fromISO(group.collection_date);
                            if (filters.startDate && sampleDate < DateTime.fromISO(filters.startDate)) {
                                return false;
                            }
                            if (filters.endDate && sampleDate > DateTime.fromISO(filters.endDate)) {
                                return false;
                            }
                            return true;
                        });

                    // Only include locations that have samples matching the filters
                    if (locationSamples.length > 0) {
                        return {
                            lat: location.lat,
                            lng: location.long,
                            name: location.label,
                            id: location.id
                        };
                    }
                }
                return null;
            })
            .filter((point): point is GlobePoint => point !== null);
    }, [filteredLocations, sampleGroups, filters]);

    const handlePointClick = useCallback(
        (
            point: object, // The raw object from react-globe.gl
            _event: MouseEvent,
            _coords: { lat: number; lng: number; altitude: number }
        ) => {
            // Try to cast or narrow `point` to your GlobePoint
            const pointData = point as GlobePoint;

            // Then your existing logic:
            const selectedLocation = filteredLocations.find(loc => loc.id === pointData.id);
            if (!selectedLocation) return;

            setSelectedRightItem(selectedLocation);

            if (globeRef.current) {
                globeRef.current.pointOfView(
                    {
                        lat: selectedLocation.lat,
                        lng: selectedLocation.long,
                        altitude: finalGlobeConfig.defaultAltitude,
                    },
                    finalGlobeConfig.transitionDuration
                );
            }
        },
        [filteredLocations, setSelectedRightItem, finalGlobeConfig]
    );


    // Handle window resizing
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Loading and error states
    if (locationsLoading) {
        return <div>Loading Globe...</div>;
    }
    if (locationsError) {
        return <div>Error loading globe data: {locationsError.message}</div>;
    }

    // 5) Pass your user-defined or default values into the Globe.
    return (
        <div className="globe-container">
            <Globe
                ref={globeRef}
                globeImageUrl={globeImage}
                pointsData={pointsData}
                onPointClick={handlePointClick}
                pointAltitude={finalGlobeConfig.pointAltitude}
                pointRadius={finalGlobeConfig.pointRadius}
                pointColor={finalGlobeConfig.pointColor}
                pointLabel="name"
                backgroundColor={finalGlobeConfig.backgroundColor}
                enablePointerInteraction={true}
                width={dimensions.width}
                height={dimensions.height}
            />
        </div>
    );
};

GlobeComponent.displayName = 'GlobeComponent';
export default GlobeComponent;
