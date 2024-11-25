// src/renderer/components/GlobeComponent.tsx

import React, { useRef, useMemo, useCallback} from 'react';
import Globe, {GlobeMethods} from 'react-globe.gl';
import globeImage from '../assets/globe.jpg';
import { DateTime } from 'luxon';
import useData from '../hooks/useData';
import useUI from '../hooks/useUI';

// Optional: Define the type for a point to improve type safety
interface GlobePoint {
    lat: number;
    lng: number;
    name: string;
    id: string;
}

const GlobeComponent: React.FC = () => {
    const globeRef = useRef<React.MutableRefObject<GlobeMethods | undefined>>(null);
    const { sampleGroupData, locations } = useData();
    const { setSelectedRightItem, openRightSidebar, filters } = useUI();

    // Memoize filteredSampleGroups to avoid recalculating on every render
    const filteredSampleGroups = useMemo(() => {
        return Object.values(sampleGroupData).filter((group) => {
            // Filter by location
            if (
                filters.selectedLocations.length > 0 &&
                !filters.selectedLocations.includes(group.loc_id)
            ) {
                return false;
            }

            // Filter by date range
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
    }, [sampleGroupData, filters]);

    // Memoize pointsData to prevent unnecessary computations
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

    // Memoize the click handler to maintain a stable reference
    const handlePointClick = useCallback(
        (point: any) => {
            const selectedLocation = locations.find((loc) => loc.id === point.id);
            if (selectedLocation) {
                setSelectedRightItem(selectedLocation);
                openRightSidebar(); // Explicitly open the sidebar
                globeRef?.current?.current?.pointOfView({
                    lat: selectedLocation.lat,
                    lng: selectedLocation.long,
                    altitude: 0.5,
                }, 1000); // Optional: Add animation duration
            }
        },
        [locations, setSelectedRightItem, openRightSidebar]
    );

    // Optional: Optimize Globe's pointColor if it depends on props/state
    const getPointColor = useCallback(() => 'cyan', []);

    return (
        <div
            className="globe-container"
            style={{ height: '100vh', width: '100%' }}
        >
            <Globe
                ref={globeRef?.current || undefined}
                globeImageUrl={globeImage}
                pointsData={pointsData}
                onPointClick={handlePointClick}
                pointAltitude={0.1}
                pointRadius={0.05}
                pointColor={getPointColor} // Use the memoized color function
                pointLabel="name"
                backgroundColor="#000000" // Dark background
                // Optional: Add additional optimizations or configurations
                enablePointerInteraction={true}
                // Consider adding `animateIn` or other Globe props as needed
                width={window.innerWidth} // Responsive width
                height={window.innerHeight} // Responsive height
            />
            {/* Optional: Add overlay components or controls here */}
        </div>
    );
};

// Wrap the component with React.memo to prevent re-renders unless props change
export default React.memo(GlobeComponent);
