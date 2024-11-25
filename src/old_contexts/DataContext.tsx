// DataProvider.tsx

import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect, useMemo,
  useState,
} from 'react';
import useAuth from '../old_hooks/useAuth';
import { useFileTreeData } from '../old_hooks/useFileTreeData';
import {
  fetchData,
  subscribeToTable,
  upsertData,
  deleteData,
  removeSubscription,
  removeFromStorage,
  listAllFiles,
  fetchSampleMetadataEntries,
  deleteSampleMetadataEntries,
} from '../old_utils/supabaseUtils';
import { useLocations, LocationOption } from '../old_hooks/useLocations';
import {
  processCreateSampleGroup,
  SampleGroup,
} from '../old_utils/sampleGroupUtils';
import { processCreateFolder } from '../old_utils/folderUtils';
import { useOnlineStatus } from '../old_hooks/useOnlineStatus';
import supabase from '../old_utils/supabaseClient';
import {
  addPendingOperation,
  getAllPendingOperations,
  deletePendingOperation,
  addOrUpdateSampleGroup,
  getAllSampleGroups,
  deleteSampleGroup,
} from '../old_utils/offlineStorage';
import { PendingOperation } from '../old_utils/offlineStorage';
import { v4 as uuidv4 } from 'uuid';
import { TreeItem } from '../components/LeftSidebar/LeftSidebarTree.tsx';
import { load } from '@tauri-apps/plugin-store';

export type ItemType = 'sampleGroup' | 'folder';

export interface DataContextType {
  fileTreeData: TreeItem[] | null;
  setFileTreeData: React.Dispatch<React.SetStateAction<TreeItem[]>>;
  sampleGroupData: Record<string, SampleGroup>;
  setSampleGroupData: React.Dispatch<
      React.SetStateAction<Record<string, SampleGroup>>
  >;
  addItem: (type: ItemType, inputs: Record<string, string>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  isSyncing: boolean;
  locations: LocationOption[];
  isOnline: boolean;
}

export const DataContext = createContext<DataContextType | undefined>(
    undefined,
);

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { user, userOrgId, userOrgShortId } = useAuth();
  const { fileTreeData, setFileTreeData, isSyncing } = useFileTreeData();
  const { locations } = useLocations();
  const [sampleGroupData, setSampleGroupData] = useState<
      Record<string, SampleGroup>
  >({});

  const fetchSampleGroups = useCallback(async () => {
    if (!userOrgId) return;

    try {
      if (navigator.onLine) {
        // Online: Fetch data from Supabase
        const sampleGroups = await fetchData('sample_group_metadata', {
          org_id: userOrgId,
        });
        const groupData: Record<string, SampleGroup> = {};

        for (const group of sampleGroups) {
          groupData[group.id] = {
            id: group.id,
            name: group.human_readable_sample_id,
            human_readable_sample_id: group.human_readable_sample_id,
            org_id: group.org_id,
            user_id: group.user_id,
            loc_id: group.loc_id,
            storage_folder: group.storage_folder,
            collection_date: group.collection_date,
            collection_datetime_utc: group.collection_datetime_utc || null,
            latitude_recorded: group.latitude_recorded,
            longitude_recorded: group.longitude_recorded,
            notes: group.notes || null,
          };

          // Save to IndexedDB
          await addOrUpdateSampleGroup(groupData[group.id]);
        }

        setSampleGroupData(groupData);

        // Also store in Tauri Store
        const store = await load('sampleGroupData.json', {
          autoSave: false,
          createNew: true,
        });
        await store.set('sampleGroupData', groupData);
        await store.save();
      } else {
        // Offline: Load from IndexedDB
        const localGroups = await getAllSampleGroups();
        const groupData: Record<string, SampleGroup> = {};

        localGroups.forEach((group) => {
          groupData[group.id] = group;
        });

        setSampleGroupData(groupData);
      }
    } catch (error) {
      console.error('Error loading sample group data:', error);

      // Fallback to Tauri Store
      const store = await load('sampleGroupData.json', {
        autoSave: false,
        createNew: true,
      });
      const localData = await store.get<Record<string, SampleGroup>>(
          'sampleGroupData',
      );
      setSampleGroupData(localData || {});
    }
  }, [userOrgId]);

  const setupSubscriptions = useCallback(() => {
    if (!userOrgId) return;

    const sampleGroupChannel = subscribeToTable(
        'sample_group_metadata',
        { org_id: userOrgId },
        async (payload) => {
          const group = payload.new as SampleGroup;
          const groupId = group.id;

          let newData: Record<string, SampleGroup> = {};

          setSampleGroupData((prev) => {
            newData = { ...prev };
            if (payload.eventType === 'DELETE') {
              delete newData[groupId];
              // Delete from IndexedDB
              deleteSampleGroup(groupId);
            } else {
              const updatedGroup = {
                id: group.id,
                name: group.human_readable_sample_id,
                human_readable_sample_id: group.human_readable_sample_id,
                org_id: group.org_id,
                user_id: group.user_id,
                loc_id: group.loc_id,
                storage_folder: group.storage_folder,
                collection_date: group.collection_date,
                collection_datetime_utc: group.collection_datetime_utc || undefined,
                notes: group.notes || null,
                latitude_recorded: group.latitude_recorded,
                longitude_recorded: group.longitude_recorded,
                data: {},
              };
              newData[groupId] = updatedGroup;
              // Save to IndexedDB
              addOrUpdateSampleGroup(updatedGroup);
            }

            return newData;
          });

          // Update Tauri Store
          const store = await load('sampleGroupData.json', {
            autoSave: false,
            createNew: true,
          });
          await store.set('sampleGroupData', newData);
          await store.save();
        },
    );

    return () => {
      removeSubscription(sampleGroupChannel);
    };
  }, [userOrgId]);

  const processPendingOperations = useCallback(async () => {
    const pendingOperations = await getAllPendingOperations();

    for (const operation of pendingOperations) {
      try {
        const { type, table, data } = operation;

        switch (type) {
          case 'update':
            await supabase
                .from(table)
                .update(data.updateData)
                .eq('id', data.id);
            break;
          case 'insert':
            await supabase.from(table).insert(data);
            break;
          case 'delete':
            await supabase.from(table).delete().eq('id', data.id);
            break;
          case 'upsert':
            await supabase.from(table).upsert(data);
            break;
        }

        await deletePendingOperation(operation.id);
      } catch (error) {
        console.error(`Error processing operation ${operation.id}:`, error);
      }
    }
  }, []);

  const addItem = useCallback(
      async (type: ItemType, inputs: Record<string, string>) => {
        try {
          if (!user || !userOrgId || !userOrgShortId) {
            throw new Error('User or organization information is missing.');
          }

          if (type === 'sampleGroup') {
            // Generate a new unique ID
            const newId = uuidv4();

            // Process and create the SampleGroup
            const sampleGroup = await processCreateSampleGroup(
                inputs,
                user,
                userOrgId,
                userOrgShortId,
                locations,
                newId, // Pass newId here
            );

            const newSampleGroup: SampleGroup = {
              id: newId,
              name: sampleGroup.name,
              human_readable_sample_id: sampleGroup.human_readable_sample_id,
              org_id: sampleGroup.org_id,
              user_id: sampleGroup.user_id,
              loc_id: sampleGroup.loc_id,
              storage_folder: sampleGroup.storage_folder,
              collection_date: sampleGroup.collection_date,
              collection_datetime_utc:
                  sampleGroup.collection_datetime_utc || undefined,
              latitude_recorded: sampleGroup.latitude_recorded || null,
              longitude_recorded: sampleGroup.longitude_recorded || null,
              notes: sampleGroup.notes || null,
            };

            // Save to sampleGroupData
            setSampleGroupData((prevSampleGroupData) => ({
              ...prevSampleGroupData,
              [newId]: newSampleGroup,
            }));

            // Save to IndexedDB
            await addOrUpdateSampleGroup(newSampleGroup);

            // Update Tauri Store
            const store = await load('sampleGroupData.json', {
              autoSave: false,
              createNew: true,
            });
            const currentData =
                (await store.get<Record<string, SampleGroup>>('sampleGroupData')) ||
                {};
            currentData[newId] = newSampleGroup;
            await store.set('sampleGroupData', currentData);
            await store.save();

            // Create the TreeItem
            const newTreeItem: TreeItem = {
              id: newId, // Use the same ID
              text: sampleGroup.name,
              droppable: false,
              type: 'sampleGroup',
              parent_id: null,
            };

            // Update fileTreeData
            setFileTreeData((prevFileTreeData) => [...prevFileTreeData, newTreeItem]);

            // Handle online/offline upsert
            if (navigator.onLine) {
              await upsertData(
                  'sample_group_metadata',
                  {
                    id: newId,
                    created_at: new Date().toISOString(),
                    org_id: sampleGroup.org_id,
                    user_id: sampleGroup.user_id,
                    human_readable_sample_id: sampleGroup.human_readable_sample_id,
                    collection_date: sampleGroup.collection_date,
                    collection_datetime_utc:
                        sampleGroup.collection_datetime_utc || null,
                    storage_folder: sampleGroup.storage_folder,
                    loc_id: sampleGroup.loc_id,
                    latitude_recorded: sampleGroup.latitude_recorded || null,
                    longitude_recorded: sampleGroup.longitude_recorded || null,
                    notes: sampleGroup.notes || null,
                  },
                  'id',
              );
            } else {
              const pendingOperation: PendingOperation = {
                id: newId,
                type: 'insert',
                table: 'sample_group_metadata',
                data: {
                  id: newId,
                  created_at: new Date().toISOString(),
                  org_id: sampleGroup.org_id,
                  user_id: sampleGroup.user_id,
                  human_readable_sample_id: sampleGroup.human_readable_sample_id,
                  collection_date: sampleGroup.collection_date,
                  collection_datetime_utc:
                      sampleGroup.collection_datetime_utc || null,
                  storage_folder: sampleGroup.storage_folder,
                  loc_id: sampleGroup.loc_id,
                  latitude_recorded: sampleGroup.latitude_recorded || null,
                  longitude_recorded: sampleGroup.longitude_recorded || null,
                  notes: sampleGroup.notes || null,
                },
              };
              await addPendingOperation(pendingOperation);
            }
          } else if (type === 'folder') {
            // Handle folder creation
            const newFolder = await processCreateFolder(inputs);
            setFileTreeData((prevFileTreeData) => [...prevFileTreeData, newFolder]);
          } else {
            throw new Error(`Unknown item type: ${type}`);
          }
        } catch (error: any) {
          console.error('Error adding item:', error);
          throw error;
        }
      },
      [user, userOrgId, userOrgShortId, locations, setSampleGroupData, setFileTreeData],
  );

  const deleteItem = useCallback(
      async (id: string) => {
        try {
          console.log(`Attempting to delete item with ID: ${id}`);

          const removeItem = (
              items: TreeItem[],
              idToRemove: string,
          ): TreeItem[] => {
            return items
                .filter((item) => item.id !== idToRemove)
                .map((item) => ({
                  ...item,
                  children: item.children
                      ? removeItem(item.children, idToRemove)
                      : undefined,
                }));
          };

          // Remove from sampleGroupData
          setSampleGroupData((prev) => {
            const newData = { ...prev };
            delete newData[id];
            return newData;
          });

          // Remove from IndexedDB
          await deleteSampleGroup(id);

          // Update Tauri Store
          const store = await load('sampleGroupData.json', {
            autoSave: false,
            createNew: true,
          });
          const currentData =
              (await store.get<Record<string, SampleGroup>>('sampleGroupData')) || {};
          delete currentData[id];
          await store.set('sampleGroupData', currentData);
          await store.save();

          // Remove from fileTreeData
          setFileTreeData((prevFileTreeData) => removeItem(prevFileTreeData, id));

          // Handle deletion from database or offline storage
          if (navigator.onLine) {
            // Handle online deletion
            const itemToDelete = sampleGroupData[id];
            if (itemToDelete) {
              // Perform any necessary cleanup, e.g., delete files from storage
              // Delete raw data files
              const storageFolderPath = itemToDelete.storage_folder;
              const humanReadableSampleId = itemToDelete.human_readable_sample_id;

              const rawDataPathsToDelete = await listAllFiles(
                  'raw-data',
                  storageFolderPath,
              );
              if (rawDataPathsToDelete.length > 0) {
                await removeFromStorage('raw-data', rawDataPathsToDelete);
              }

              // Handle processed data deletion
              const sampleMetadataEntries = await fetchSampleMetadataEntries(
                  humanReadableSampleId,
              );
              const processedDataPathsToDelete = sampleMetadataEntries
                  .map((entry) => entry.processed_storage_path)
                  .filter(Boolean)
                  .map((path) => path.replace(/\/+/g, '/'));

              if (processedDataPathsToDelete.length > 0) {
                await removeFromStorage(
                    'processed-data',
                    processedDataPathsToDelete,
                );
              }

              // Delete metadata entries
              const sampleMetadataIds = sampleMetadataEntries.map(
                  (entry) => entry.id,
              );
              if (sampleMetadataIds.length > 0) {
                await deleteSampleMetadataEntries(sampleMetadataIds);
              }
            }

            await deleteData('sample_group_metadata', { id });
          } else {
            const pendingOperation: PendingOperation = {
              id: id,
              type: 'delete',
              table: 'sample_group_metadata',
              data: { id },
            };
            await addPendingOperation(pendingOperation);
          }
        } catch (error) {
          console.error(`Error deleting item with ID ${id}:`, error);
          throw error;
        }
      },
      [setSampleGroupData, setFileTreeData],
  );

  useEffect(() => {
    if (userOrgId) {
      fetchSampleGroups();
      const unsubscribe = setupSubscriptions();
      return () => {
        unsubscribe && unsubscribe();
      };
    } else {
      // Load offline data
      const loadLocalData = async () => {
        const localGroups = await getAllSampleGroups();
        const groupData: Record<string, SampleGroup> = {};
        localGroups.forEach((group) => {
          groupData[group.id] = group;
        });
        setSampleGroupData(groupData);

        // Load from Tauri Store if available
        const store = await load('sampleGroupData.json', {
          autoSave: false,
          createNew: true,
        });
        const localData = await store.get<Record<string, SampleGroup>>(
            'sampleGroupData',
        );
        setSampleGroupData(localData || groupData);
      };
      loadLocalData();
    }
  }, [fetchSampleGroups, setupSubscriptions, userOrgId]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online, processing pending operations.');
      processPendingOperations();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      processPendingOperations();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [processPendingOperations]);

  const synchronizeData = useCallback(async () => {
    await processPendingOperations();
  }, [processPendingOperations]);

  const isOnline = useOnlineStatus(synchronizeData);

  // Memoize the context value
  const contextValue = useMemo(
      () => ({
        fileTreeData: fileTreeData || [],
        setFileTreeData,
        sampleGroupData,
        setSampleGroupData,
        addItem,
        deleteItem,
        isSyncing,
        locations,
        isOnline,
      }),
      [
        fileTreeData,
        setFileTreeData,
        sampleGroupData,
        setSampleGroupData,
        addItem,
        deleteItem,
        isSyncing,
        locations,
        isOnline,
      ],
  );

  return (
      <DataContext.Provider value={contextValue}>
        {children}
      </DataContext.Provider>
  );
};

export default DataProvider;
