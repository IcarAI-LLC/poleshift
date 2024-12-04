import React, { useRef, useMemo, useCallback } from 'react';
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
    pointRadius: 0.05,
    backgroundColor: '#000000',
    pointColor: 'cyan',
    transitionDuration: 1000,
    defaultAltitude: 0.5,
} as const;

export const GlobeComponent: React.FC = () => {
    // Use strict typing for the ref
    const globeRef = useRef<React.MutableRefObject<GlobeMethods | undefined>>(null);

    const { sampleGroups, locations } = useData();
    const { setSelectedRightItem, toggleRightSidebar, filters } = useUI();

    // Filter sample groups based on location and date filters
    const filteredSampleGroups = useMemo(() => {
        return Object.values(sampleGroups).filter((group: SampleGroupMetadata) => {
            // Check location filter
            if (filters.selectedLocations.length > 0 &&
                !filters.selectedLocations.includes(group.loc_id || '')) {
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

    // Transform filtered groups into globe points
    const pointsData = useMemo<GlobePoint[]>(() => {
        return filteredSampleGroups
            .reduce<GlobePoint[]>((points, group) => {
                const location = locations.find(loc => loc.id === group.loc_id);

                if (location?.lat != null && location?.long != null) {
                    points.push({
                        lat: location.lat,
                        lng: location.long,
                        name: location.label,
                        id: location.id,
                    });
                }

                return points;
            }, []);
    }, [filteredSampleGroups, locations]);

    // Handle point click with proper typing
    const handlePointClick = useCallback((
        pointData: unknown,
        _event: MouseEvent,
        coords: GlobeClickCoords
    ) => {
        const point = pointData as GlobePoint;
        const selectedLocation = locations.find(loc => loc.id === point.id);

        if (!selectedLocation) return;

        setSelectedRightItem(selectedLocation);
        toggleRightSidebar(false);

        const globeInstance = globeRef?.current?.current;
        if (globeInstance) {
            globeInstance.pointOfView(
                {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.long,
                    altitude: GLOBE_CONFIG.defaultAltitude,
                },
                GLOBE_CONFIG.transitionDuration
            );
        }
    }, [locations, setSelectedRightItem, toggleRightSidebar]);

    // Memoize dimensions to prevent unnecessary rerenders
    const dimensions = useMemo(() => ({
        width: window.innerWidth,
        height: window.innerHeight
    }), []);

    return (
        <div className="globe-container">
            <Globe
                ref={globeRef?.current}
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

export default React.memo(GlobeComponent);