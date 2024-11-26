import React, { useRef, useMemo, useCallback } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import globeImage from '../assets/globe.jpg';
import { DateTime } from 'luxon';

import { useData, useUI } from '../lib/hooks';
import type { ResearchLocation, SampleGroup } from '../lib/types';

interface GlobePoint {
    lat: number;
    lng: number;
    name: string;
    id: string;
}

const GlobeComponent: React.FC = () => {
    const globeRef = useRef<React.MutableRefObject<GlobeMethods | undefined>>(null);
    const { sampleGroups, locations } = useData();
    const { setSelectedRightItem, toggleRightSidebar, filters } = useUI();

    const filteredSampleGroups = useMemo(() => {
        return Object.values(sampleGroups).filter((group: SampleGroup) => {
            if (
                filters.selectedLocations.length > 0 &&
                !filters.selectedLocations.includes(group.loc_id)
            ) {
                return false;
            }

            const sampleDate = group.collection_date
                ? DateTime.fromISO(group.collection_date)
                : null;
            const startDate = filters.startDate
                ? DateTime.fromISO(filters.startDate)
                : null;
            const endDate = filters.endDate
                ? DateTime.fromISO(filters.endDate)
                : null;

            if (startDate && sampleDate && sampleDate < startDate) {
                return false;
            }
            if (endDate && sampleDate && sampleDate > endDate) {
                return false;
            }

            return true;
        });
    }, [sampleGroups, filters]);

    const pointsData = useMemo<GlobePoint[]>(() => {
        return filteredSampleGroups
            .map((group) => {
                const location = locations.find((loc) => loc.id === group.loc_id);
                if (location && typeof location.lat === 'number' && typeof location.long === 'number') {
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

    // Updated handler with correct type signature
    const handlePointClick = useCallback(
        //@ts-ignore
        (point: object, event: MouseEvent, coords: { lat: number; lng: number; altitude: number }) => {
            // Type assertion since we know our point data structure
            const globePoint = point as GlobePoint;
            const selectedLocation = locations.find((loc: ResearchLocation) => loc.id === globePoint.id);

            if (selectedLocation) {
                setSelectedRightItem(selectedLocation);
                toggleRightSidebar(false);

                const globeInstance = globeRef?.current?.current;
                if (globeInstance) {
                    globeInstance.pointOfView(
                        {
                            lat: selectedLocation.lat,
                            lng: selectedLocation.long,
                            altitude: 0.5,
                        },
                        1000
                    );
                }
            }
        },
        [locations, setSelectedRightItem, toggleRightSidebar]
    );

    const getPointColor = useCallback(() => 'cyan', []);

    return (
        <div className="globe-container">
            <Globe
                ref={globeRef?.current || undefined}
                globeImageUrl={globeImage}
                pointsData={pointsData}
                onPointClick={handlePointClick}
                pointAltitude={0.1}
                pointRadius={0.05}
                pointColor={getPointColor}
                pointLabel="name"
                backgroundColor="#000000"
                enablePointerInteraction={true}
                width={window.innerWidth}
                height={window.innerHeight}
            />
        </div>
    );
};

export default React.memo(GlobeComponent);