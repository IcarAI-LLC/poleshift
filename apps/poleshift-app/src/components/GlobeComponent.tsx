//src/components/GlobeComponent.tsx
import React, {
  useRef,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { DateTime } from 'luxon';
import Image from '../assets/globe-small.jpg';
import { useData } from '../hooks/useData.ts';
import { useUI } from '../hooks/useUI.ts';
import { useQuery } from '@powersync/react';
import useSettings from '../hooks/useSettings.ts';
import { Loader2 } from 'lucide-react';

interface GlobePoint {
  lat: number;
  lng: number;
  name: string;
  id: string;
}

const GLOBE_CONFIG = {
  pointAltitude: 10,
  pointRadius: 0.1,
  pointColor: 'rgba(0, 255, 255, 0.8)',
  backgroundColor: '#000000',
  transitionDuration: 0,
  defaultAltitude: 0.5,
} as const;

export const GlobeComponent: React.FC = () => {
  const { userSettings } = useSettings();
  const firstUserSetting = userSettings || null;
  const userGlobeColor =
    firstUserSetting?.globe_datapoint_color ?? GLOBE_CONFIG.pointColor;
  const userGlobeDiameter = parseFloat(
    firstUserSetting?.globe_datapoint_diameter ??
      String(GLOBE_CONFIG.pointRadius)
  );
  const userGlobeAltitude = firstUserSetting
    ? firstUserSetting.globe_datapoint_poles
      ? 0.1
      : 0
    : 0;

  const finalGlobeConfig = {
    ...GLOBE_CONFIG,
    pointAltitude: userGlobeAltitude,
    pointRadius: userGlobeDiameter,
    pointColor: () => userGlobeColor,
  };

  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const { filters, setSelectedRightItem } = useUI();

  const { query: filteredLocationsQuery, params: filteredLocationsParams } =
    useMemo(() => {
      let query = `
      SELECT DISTINCT sl.id, sl.lat, sl.long, sl.label
      FROM sample_locations sl
      WHERE sl.is_enabled = 1
    `;
      const params: string[] = [];

      if (filters.selectedLocations.length > 0) {
        const placeholders = filters.selectedLocations
          .map(() => '?')
          .join(', ');
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

  const {
    data: filteredLocations = [],
    isLoading: locationsLoading,
    error: locationsError,
  } = useQuery(filteredLocationsQuery, filteredLocationsParams);

  const { sampleGroups } = useData();

  const pointsData = useMemo<GlobePoint[]>(() => {
    return filteredLocations
      .map((location) => {
        if (location?.lat != null && location?.long != null) {
          const locationSamples = Object.values(sampleGroups)
            .filter((group) => group.loc_id === location.id)
            .filter((group) => {
              // Filter by excluded status
              if (!filters.showExcluded && group.excluded == true) {
                return false;
              }

              // Filter by date
              if (!group.collection_date) return true;
              const sampleDate = DateTime.fromISO(group.collection_date);
              if (
                filters.startDate &&
                sampleDate < DateTime.fromISO(filters.startDate)
              ) {
                return false;
              }
              return !(
                filters.endDate &&
                sampleDate > DateTime.fromISO(filters.endDate)
              );
            });

          // Only include locations that have samples matching the filters
          if (locationSamples.length > 0) {
            return {
              lat: location.lat,
              lng: location.long,
              name: location.label,
              id: location.id,
            };
          }
        }
        return null;
      })
      .filter((point): point is GlobePoint => point !== null);
  }, [
    filteredLocations,
    sampleGroups,
    filters.startDate,
    filters.endDate,
    filters.showExcluded,
  ]);

  const handlePointClick = useCallback(
    (point: object) => {
      const pointData = point as GlobePoint;
      const selectedLocation = filteredLocations.find(
        (loc) => loc.id === pointData.id
      );
      if (!selectedLocation) return;

      setSelectedRightItem(selectedLocation);
      console.log(globeRef.current?.lights().pop());
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

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (locationsLoading) {
    return (
      <div className={'flex justify-center items-center h-screen w-screen'}>
        <Loader2 className='animate-spin' />
      </div>
    );
  }
  if (locationsError) {
    return <div>Error loading globe data: {locationsError.message}</div>;
  }

  return (
    <div className='fixed' style={{ overflow: 'hidden' }}>
      <Globe
        ref={globeRef}
        globeImageUrl={Image}
        pointsData={pointsData}
        onPointClick={handlePointClick}
        pointAltitude={finalGlobeConfig.pointAltitude}
        pointRadius={finalGlobeConfig.pointRadius}
        pointColor={finalGlobeConfig.pointColor}
        pointLabel='name'
        backgroundColor={finalGlobeConfig.backgroundColor}
        enablePointerInteraction={true}
        width={dimensions.width}
        height={dimensions.height}
        waitForGlobeReady={true}
      />
    </div>
  );
};

GlobeComponent.displayName = 'GlobeComponent';
export default GlobeComponent;
