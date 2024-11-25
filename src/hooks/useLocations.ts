import { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';
import { load } from '@tauri-apps/plugin-store';
import { useOnlineStatus } from './useOnlineStatus';

export interface LocationOption {
  id: string;
  char_id: string;
  label: string;
  lat: number;
  long: number;
}

export const useLocations = () => {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const store = load('locations20.json', { autoSave: false });

  const synchronizeData = async () => {

    try {
      const { data, error } = await supabase
          .from('sample_locations')
          .select('id, char_id, label, lat, long')
          .eq('is_enabled', true);

      if (error || !data) {
        console.error('Error fetching sample locations:', error?.message);
        // Fallback to local storage if fetching from Supabase fails
        const localData = (await store).get<LocationOption[]>('locations');
        setLocations(Array.isArray(localData) ? localData : []);
      } else {
        setLocations(data);
        // Save fetched data to local storage
        (await store).set('locations', data);
        await (await store).save();
      }
    } catch (err) {
      console.error('Unexpected error during synchronization:', err);
      const localData = (await store).get<LocationOption[]>('locations');
      setLocations(Array.isArray(localData) ? localData : []);
    }
  };

  const isOnline = useOnlineStatus(synchronizeData);

  useEffect(() => {
    const fetchLocations = async () => {
      const store = await load('locations.json', { autoSave: false, createNew: true });

      if (!isOnline) {
        // Fetch from local storage if offline
        const localData = store.get<LocationOption[]>('locations');
        setLocations(Array.isArray(localData) ? localData : []);
      }
    };

    fetchLocations();
  }, [isOnline]);

  // Function to get a location by loc_id
  const getLocationById = (loc_id: string | null) => {
    if (!loc_id) return null;
    return locations.find((location) => location.id === loc_id) || null;
  };

  return { locations, getLocationById };
};