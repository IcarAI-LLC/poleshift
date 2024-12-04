import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { DateTime } from 'luxon';
import globeImage from '../assets/globe.jpg';

import { useData, useUI } from '../lib/hooks';
import type { SampleLocation, SampleGroupMetadata } from '../lib/types';

interface GlobePoint {
    lat: number;
    lng: number;
    name: string;
    id: string;
}

interface GlobeClickCoords {
    lat: number;
    lng: number;
    altitude: number;
}

const GLOBE_CONFIG = {
    pointAltitude: 0.1,
    pointRadius: 0.2, // Increased for better visibility
    backgroundColor: '#000000',
    pointColor: (d: GlobePoint) => 'rgba(0, 255, 255, 0.8)', // More distinct color
    transitionDuration: 1000,
    defaultAltitude: 0.5,
} as const;

export const GlobeComponent: React.FC = () => {
    const globeRef = useRef<GlobeMethods | undefined>(undefined);

    const { sampleGroups, locations } = useData();
    const { setSelectedRightItem, filters } = useUI();

    // Debugging statements
    console.log('Sample Groups:', sampleGroups);
    console.log('Locations:', locations);

    // Filter sample groups based on location and date filters
    const filteredSampleGroups = useMemo(() => {
        return Object.values(sampleGroups).filter((group: SampleGroupMetadata) => {
            // Check location filter
            if (
                filters.selectedLocations.length > 0 &&
                !filters.selectedLocations.includes(group.loc_id || '')
            ) {
                return false;
            }

            // Check date filters if collection date exists
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
    }, [sampleGroups, filters]);

    // Debugging statement
    console.log('Filtered Sample Groups:', filteredSampleGroups);

    // Transform filtered groups into globe points
    const pointsData = useMemo<GlobePoint[]>(() => {
        return filteredSampleGroups
            .map(group => {
                const location = locations.find(loc => loc.id === group.loc_id);
                if (location?.lat != null && location?.long != null) {
                    return {
                        lat: location.lat,
                        lng: location.long,
                        name: location.label,
                        id: location.id,
                    };
                }
                return null;
            })
            .filter((point): point is GlobePoint => point !== null);
    }, [filteredSampleGroups, locations]);

    // Debugging statement
    console.log('Points Data:', pointsData);

    // Handle point click with proper typing
    const handlePointClick = useCallback(
        (pointData: GlobePoint, _event: MouseEvent, coords: GlobeClickCoords) => {
            const selectedLocation = locations.find(loc => loc.id === pointData.id);

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
        [locations, setSelectedRightItem]
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

    return (
        <div className="globe-container">
            <Globe
                ref={globeRef}
                globeImageUrl={globeImage}
                pointsData={pointsData}
                onPointClick={handlePointClick}
                pointAltitude={GLOBE_CONFIG.pointAltitude}
                pointRadius={GLOBE_CONFIG.pointRadius}
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
