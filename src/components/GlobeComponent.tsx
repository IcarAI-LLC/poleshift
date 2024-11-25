// src/renderer/components/GlobeComponent.tsx

import React, { useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import globeImage from 'assets/globe.jpg';
import { DateTime } from 'luxon';
import useData from '../hooks/useData';
import useUI from '../hooks/useUI';

const GlobeComponent: React.FC = () => {
  const globeRef = useRef<any>(null);
  const { sampleGroupData, locations } = useData();
  const { setSelectedRightItem, openRightSidebar, filters } = useUI();

  // Extract location IDs with sample groups
  const locIdsWithSampleGroups = new Set(
    Object.values(sampleGroupData).map((group) => group.loc_id),
  );

  // Apply filters to sample groups
  const filteredSampleGroups = Object.values(sampleGroupData).filter(
    (group) => {
      // Filter by location
      if (
        filters.selectedLocations.length > 0 &&
        !filters.selectedLocations.includes(group.loc_id)
      ) {
        return false;
      }
      console.log(group.collection_date);
      console.log(filters.startDate);
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
    },
  );

  // Prepare data for plotting based on filtered sample groups
  const pointsData = filteredSampleGroups
    .map((group) => {
      const location = locations.find((loc) => loc.id === group.loc_id);
      if (location && location.lat != null && location.long != null) {
        return {
          lat: location.lat,
          lng: location.long,
          name: location.label,
          id: location.id,
        };
      }
      return null;
    })
    .filter((point) => point !== null);

  const handlePointClick = (point: any) => {
    const selectedLocation = locations.find((loc) => loc.id === point.id);
    if (selectedLocation) {
      setSelectedRightItem(selectedLocation);
      openRightSidebar(); // Explicitly open the sidebar
      globeRef.current.pointOfView({
        lat: selectedLocation.lat,
        lng: selectedLocation.long,
        altitude: 0.5,
      });
    }
  };

  return (
    <div className="globe-container" style={{ height: '100vh', width: '100%' }}>
      <Globe
        ref={globeRef}
        globeImageUrl={globeImage}
        pointsData={pointsData}
        onPointClick={handlePointClick}
        pointAltitude={0.1}
        pointRadius={0.05}
        pointColor={() => 'cyan'} // Bright color for contrast
        pointLabel="name"
        backgroundColor="#000000" // Dark background
        ambientLight={0.5} // Optional: Adjust ambient lighting
        directionalLight={1.0} // Optional: Adjust directional lighting
        width={window.innerWidth} // Responsive width
        height={window.innerHeight} // Responsive height
      />
    </div>
  );
};

export default GlobeComponent;
