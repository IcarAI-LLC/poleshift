import { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';
import { LazyStore } from '@tauri-apps/plugin-store';
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

  const synchronizeData = async () => {
    try {
      const { data, error } = await supabase
          .from('sample_locations')
          .select('id, char_id, label, lat, long')
          .eq('is_enabled', true);

      if (error || !data) {
        console.error('Error fetching sample locations:', error?.message);

        // Fallback to local storage if fetching from Supabase fails
        const localData = await getLocationsFromLazyStore();
        setLocations(localData);
      } else {
        setLocations(data);

        // Save fetched data to local storage
        await saveLocationsToLazyStore(data);
      }
    } catch (err) {
      console.error('Unexpected error during synchronization:', err);

      const localData = await getLocationsFromLazyStore();
      setLocations(localData);
    }
  };

  const isOnline = useOnlineStatus(synchronizeData);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        if (!isOnline) {
          // Fetch from local storage if offline
          const localData = await getLocationsFromLazyStore();
          setLocations(localData);
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchLocations();
  }, [isOnline]);

  // Function to get a location by loc_id
  const getLocationById = (loc_id: string | null) => {
    if (!loc_id) return null;
    return locations.find((location) => location.id === loc_id) || null;
  };

  // Function to save locations to store
  const saveLocationsToLazyStore = async (data: LocationOption[]) => {
    try {
      const store = new LazyStore('store.json');

      // First, clear existing location keys in the store
      const keys = await store.keys();
      const locationKeys = keys.filter((key) => key.startsWith('locations.'));
      for (const key of locationKeys) {
        await store.delete(key);
      }

      // Save each item under a unique key
      for (const item of data) {
        await store.set(`locations.${item.id}`, item);
      }

      await store.save();
    } catch (error) {
      console.error('Error saving locations to store:', error);
    }
  };

  // Function to get locations from the store
  const getLocationsFromLazyStore = async (): Promise<LocationOption[]> => {
    try {
      const store = new LazyStore('store.json');

      const keys = await store.keys();
      const locationKeys = keys.filter((key) => key.startsWith('locations.'));
      const localData: LocationOption[] = [];

      for (const key of locationKeys) {
        const item = await store.get<LocationOption>(key);
        if (item) {
          localData.push(item);
        }
      }

      return localData;
    } catch (error) {
      console.error('Error getting locations from store:', error);
      return [];
    }
  };

  return { locations, getLocationById };
};
