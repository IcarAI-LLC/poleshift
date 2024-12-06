//src/components/GlobeComponent.tsx
import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { DateTime } from 'luxon';
import globeImage from '../assets/globe.jpg';

import { useData, useUI } from '../lib/hooks';

interface GlobePoint {
    lat: number;
    lng: number;
    name: string;
    id: string;
}

const GLOBE_CONFIG = {
    pointAltitude: 0.1,
    pointRadius: 0.2, // Increased for better visibility
    backgroundColor: '#000000',
    //@ts-ignore
    pointColor: (d: GlobePoint) => 'rgba(0, 255, 255, 0.8)', // More distinct color
    transitionDuration: 1000,
    defaultAltitude: 0.5,
} as const;

export const GlobeComponent: React.FC = () => {
    const globeRef = useRef<GlobeMethods | undefined>(undefined);

    const { sampleGroups, locations } = useData();
    const { setSelectedRightItem, filters } = useUI();

    // Transform locations into globe points with filter consideration
    const pointsData = useMemo<GlobePoint[]>(() => {
        const filteredLocations = locations.filter(location => {
            // If there are selected locations, only show those
            if (filters.selectedLocations.length > 0) {
                return filters.selectedLocations.includes(location.id);
            }
            return true;
        });

        // Convert locations to points
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
    }, [locations, sampleGroups, filters]);

    // Debugging statement
    console.log('Points Data:', pointsData);

    // Handle point click with proper typing
    const handlePointClick = useCallback(
        (pointData: GlobePoint, _event: MouseEvent) => {
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
                //@ts-ignore
                onPointClick={handlePointClick}
                //@ts-ignore
                pointAltitude={GLOBE_CONFIG.pointAltitude}
                //@ts-ignore
                pointRadius={GLOBE_CONFIG.pointRadius}
                //@ts-ignore
                pointColor={ GLOBE_CONFIG.pointColor }
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
