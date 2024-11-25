// src/hooks/useLocations.ts

import { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';

export interface LocationOption {
  id: string;
  char_id: string;
  label: string;
  lat: number;
  long: number;
}

export const useLocations = () => {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const isOnline = window.navigator.onLine;

  useEffect(() => {
    const fetchLocations = async () => {
      if (isOnline) {
        // Fetch locations from Supabase
        const { data, error } = await supabase
            .from('sample_locations')
            .select('id, char_id, label, lat, long')
            .eq('is_enabled', true);

        if (error) {
          console.error('Error fetching sample locations:', error.message);
          // Try to load from local storage if fetching from Supabase fails
          const localData = window.electron.store.get('locations');
          setLocations(localData || []);
        } else {
          setLocations(data || []);
          // Save to local storage
          window.electron.store.set('locations', data || []);
        }
      } else {
        // Fetch locations from local storage when offline
        const localData = window.electron.store.get('locations');
        setLocations(localData || []);
      }
    };

    fetchLocations();

    // Listen for online status changes to refresh data
    const handleOnline = () => {
      fetchLocations();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isOnline]);

  // Function to get a location by loc_id
  const getLocationById = (loc_id: string | null) => {
    if (!loc_id) return null;
    return locations.find((location) => location.id === loc_id) || null;
  };

  return { locations, getLocationById };
};
