// src/components/GlobeComponent.tsx
import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { DateTime } from 'luxon';
import globeImage from '../assets/globe.jpg';

import { useData } from '../lib/hooks/useData';
import { useUI } from '../lib/hooks/useUI';
import { useQuery } from '@powersync/react'; // Import useQuery

interface GlobePoint {
    lat: number;
    lng: number;
    name: string;
    id: string;
}

const GLOBE_CONFIG = {
    pointAltitude: 0.1,
    pointRadius: 0.1, // Increased for better visibility
    backgroundColor: '#000000',
    //@ts-ignore
    pointColor: (d: GlobePoint) => 'rgba(0, 255, 255, 0.8)', // More distinct color
    transitionDuration: 1000,
    defaultAltitude: 0.5,
} as const;

export const GlobeComponent: React.FC = () => {
    const globeRef = useRef<GlobeMethods | undefined>(undefined);

    const { filters, setSelectedRightItem } = useUI();

    // Construct the filtered query based on filters
    const { query: filteredLocationsQuery, params: filteredLocationsParams } = useMemo(() => {
        let query = `
            SELECT DISTINCT sl.id, sl.lat, sl.long, sl.label
            FROM sample_locations sl
            WHERE sl.is_enabled = 1
        `;
        const params: any[] = [];

        // Apply selected location IDs filter
        if (filters.selectedLocations.length > 0) {
            const placeholders = filters.selectedLocations.map(() => '?').join(', ');
            query += ` AND sl.id IN (${placeholders})`;
            params.push(...filters.selectedLocations);
        }

        // Apply date range filter by ensuring at least one related sample_group_metadata exists within the date range
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

    // Fetch filtered locations using useQuery
    const {
        data: filteredLocations = [],
        isLoading: locationsLoading,
        error: locationsError
    } = useQuery(filteredLocationsQuery, filteredLocationsParams, {
        // Optional: Add any additional options like caching, refetching, etc.
        // For example:
        // cacheTime: 1000 * 60 * 5, // 5 minutes
    });

    // Fetch sampleGroups from useData for further processing
    const { sampleGroups } = useData();

    // Transform filtered locations into globe points
    const pointsData = useMemo<GlobePoint[]>(() => {
        return filteredLocations
            .map(location => {
                if (location?.lat != null && location?.long != null) {
                    const locationSamples = Object.values(sampleGroups)
                        .filter(group => group.loc_id === location.id)
                        .filter(group => {
                            // Apply date filters if present
                            if (!group.collection_date) return true;

                            const sampleDate = DateTime.fromISO(group.collection_date);

                            if (filters.startDate &&
                                sampleDate < DateTime.fromISO(filters.startDate)) {
                                return false;
                            }

                            if (filters.endDate &&
                                sampleDate > DateTime.fromISO(filters.endDate)) {
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

    // Debugging statement
    console.log('Filtered Points Data:', pointsData);

    // Handle point click with proper typing
    const handlePointClick = useCallback(
        (pointData: GlobePoint, _event: MouseEvent) => {
            const selectedLocation = filteredLocations.find(loc => loc.id === pointData.id);

            if (!selectedLocation) return;

            console.log('Point clicked:', selectedLocation);
            setSelectedRightItem(selectedLocation); // This will also open the sidebar

            if (globeRef.current) {
                globeRef.current.pointOfView(
                    {
                        lat: selectedLocation.lat,
                        lng: selectedLocation.long,
                        altitude: GLOBE_CONFIG.defaultAltitude,
                    },
                    GLOBE_CONFIG.transitionDuration
                );
            }
        },
        [filteredLocations, setSelectedRightItem]
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

    // Handle loading and error states
    if (locationsLoading) {
        return <div>Loading Globe...</div>;
    }

    if (locationsError) {
        return <div>Error loading globe data: {locationsError.message}</div>;
    }

    return (
        <div className="globe-container">
            <Globe
                ref={globeRef}
                globeImageUrl={globeImage}
                pointsData={pointsData}
                //@ts-ignore
                onPointClick={handlePointClick}
                //@ts-ignore
                pointAltitude={GLOBE_CONFIG.pointAltitude}
                //@ts-ignore
                pointRadius={GLOBE_CONFIG.pointRadius}
                //@ts-ignore
                pointColor={GLOBE_CONFIG.pointColor}
                pointLabel="name"
                backgroundColor={GLOBE_CONFIG.backgroundColor}
                enablePointerInteraction={true}
                width={dimensions.width}
                height={dimensions.height}
            />
        </div>
    );
};

// Use displayName for better debugging
GlobeComponent.displayName = 'GlobeComponent';

export default GlobeComponent;
