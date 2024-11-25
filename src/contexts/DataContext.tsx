import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import useAuth from '../hooks/useAuth';
import { useFileTreeData, ExtendedTreeItem } from '../hooks/useFileTreeData';
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
} from '../utils/supabaseUtils';
import { useLocations, LocationOption } from '../hooks/useLocations';
import {
  processCreateSampleGroup,
  SampleGroup,
} from '../utils/sampleGroupUtils';
import { processCreateFolder } from '../utils/folderUtils';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import supabase from '../utils/supabaseClient';
import {
  addPendingOperation,
  getAllPendingOperations,
  deletePendingOperation,
  addOrUpdateSampleGroup,
  getAllSampleGroups,
  deleteSampleGroup,
} from '../utils/offlineStorage';

export type ItemType = 'sampleGroup' | 'folder';

export interface DataContextType {
  fileTreeData: ExtendedTreeItem[];
  setFileTreeData: React.Dispatch<React.SetStateAction<ExtendedTreeItem[]>>;
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
            data: {},
          };

          // Save to IndexedDB
          await addOrUpdateSampleGroup(groupData[group.id]);
        }

        setSampleGroupData(groupData);

        // Also store in electron store for desktop app compatibility
        if (window?.electron?.store) {
          window.electron.store.set('sampleGroupData', groupData);
        }
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
      // Fallback to electron store if available
      if (window?.electron?.store) {
        const localData = window.electron.store.get('sampleGroupData');
        setSampleGroupData(localData || {});
      }
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

          setSampleGroupData((prev) => {
            const newData = { ...prev };
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
                collection_datetime_utc: group.collection_datetime_utc || null,
                notes: group.notes || null,
                latitude_recorded: group.latitude_recorded,
                longitude_recorded: group.longitude_recorded,
                data: {},
              };
              newData[groupId] = updatedGroup;
              // Save to IndexedDB
              addOrUpdateSampleGroup(updatedGroup);
            }

            // Update electron store if available
            if (window?.electron?.store) {
              window.electron.store.set('sampleGroupData', newData);
            }

            return newData;
          });
        },
    );

    return () => {
      removeSubscription(sampleGroupChannel);
    };
  }, [userOrgId]);

  const saveTreeData = useCallback(async () => {
    if (!user || !userOrgId || !fileTreeData) return;

    try {
      const flatNodes: any[] = [];
      const flattenTree = (
          nodes: ExtendedTreeItem[],
          parentId: string | null,
      ) => {
        nodes.forEach((node) => {
          flatNodes.push({
            id: node.id,
            name: node.text,
            type: node.type,
            parent_id: parentId,
            org_id: userOrgId,
          });
          if (node.children) flattenTree(node.children, node.id);
        });
      };
      flattenTree(fileTreeData, null);

      await Promise.all(
          flatNodes.map(async (node) => {
            const existingNode = await fetchData('file_nodes', { id: node.id });

            if (
                existingNode?.[0]?.version !== undefined &&
                existingNode[0].version > node.version
            ) {
              console.warn(`Conflict detected for node: ${node.id}`);
              node = { ...node, ...existingNode[0] };
            }

            const hasChanges =
                !existingNode ||
                existingNode[0].name !== node.name ||
                existingNode[0].parent_id !== node.parent_id ||
                existingNode[0].type !== node.type;

            if (hasChanges) {
              if (navigator.onLine) {
                return upsertData('file_nodes', node, 'id');
              }
              const pendingOperation = {
                type: 'upsert',
                table: 'file_nodes',
                data: node,
              };
              await addPendingOperation(pendingOperation);
            }
          }),
      );

      // Clear changes flag in electron store if available
      if (window?.electron?.store) {
        window.electron.store.delete('fileTreeDataChanges');
      }
    } catch (error) {
      console.error('Error saving tree data:', error);
      if (window?.electron?.store) {
        window.electron.store.set('fileTreeDataChanges', true);
      }
    }
  }, [fileTreeData, user, userOrgId]);

  const addItem = useCallback(
      async (type: ItemType, inputs: Record<string, string>) => {
        try {
          if (!user || !userOrgId || !userOrgShortId) {
            throw new Error('User or organization information is missing.');
          }

          let newItem: ExtendedTreeItem;

          if (type === 'sampleGroup') {
            newItem = await processCreateSampleGroup(
                inputs,
                sampleGroupData,
                user,
                userOrgId,
                userOrgShortId,
                locations,
            );

            const newSampleGroup: SampleGroup = {
              id: newItem.id,
              name: newItem.text,
              human_readable_sample_id: newItem.human_readable_sample_id,
              org_id: newItem.org_id,
              user_id: newItem.user_id,
              loc_id: newItem.loc_id,
              storage_folder: newItem.storage_folder,
              collection_date: newItem.collection_date,
              collection_datetime_utc: newItem.collection_datetime_utc || null,
              data: {},
              latitude_recorded: newItem.latitude_recorded || null,
              longitude_recorded: newItem.longitude_recorded || null,
              notes: newItem.notes || null,
            };

            setSampleGroupData((prevSampleGroupData) => ({
              ...prevSampleGroupData,
              [newItem.id]: newSampleGroup,
            }));

            // Save to IndexedDB
            await addOrUpdateSampleGroup(newSampleGroup);

            if (navigator.onLine) {
              // Online: Upsert data to Supabase
              await upsertData(
                  'sample_group_metadata',
                  {
                    id: newItem.id,
                    created_at: new Date().toISOString(),
                    org_id: newItem.org_id,
                    user_id: newItem.user_id,
                    human_readable_sample_id: newItem.human_readable_sample_id,
                    collection_date: newItem.collection_date,
                    collection_datetime_utc:
                        newItem.collection_datetime_utc || null,
                    storage_folder: newItem.storage_folder,
                    loc_id: newItem.loc_id,
                    latitude_recorded: newItem.latitude_recorded || null,
                    longitude_recorded: newItem.longitude_recorded || null,
                    notes: newItem.notes || null,
                  },
                  'id',
              );
            } else {
              // Offline: Queue the operation
              const pendingOperation = {
                type: 'insert',
                table: 'sample_group_metadata',
                data: {
                  id: newItem.id,
                  created_at: new Date().toISOString(),
                  org_id: newItem.org_id,
                  user_id: newItem.user_id,
                  human_readable_sample_id: newItem.human_readable_sample_id,
                  collection_date: newItem.collection_date,
                  collection_datetime_utc:
                      newItem.collection_datetime_utc || null,
                  storage_folder: newItem.storage_folder,
                  loc_id: newItem.loc_id,
                  latitude_recorded: newItem.latitude_recorded || null,
                  longitude_recorded: newItem.longitude_recorded || null,
                  notes: newItem.notes || null,
                },
              };
              await addPendingOperation(pendingOperation);
            }

            // Update electron store if available
            if (window?.electron?.store) {
              window.electron.store.set('sampleGroupData', {
                ...sampleGroupData,
                [newItem.id]: newSampleGroup,
              });
            }
          } else if (type === 'folder') {
            newItem = await processCreateFolder(inputs);
          } else {
            throw new Error(`Unknown item type: ${type}`);
          }

          setFileTreeData((prevFileTreeData) => [...prevFileTreeData, newItem]);
          await saveTreeData();
        } catch (error: any) {
          console.error('Error adding item:', error);
          throw error;
        }
      },
      [
        sampleGroupData,
        saveTreeData,
        setFileTreeData,
        setSampleGroupData,
        user,
        userOrgId,
        userOrgShortId,
        locations,
      ],
  );

  const processPendingOperations = useCallback(async () => {
    const pendingOperations = await getAllPendingOperations();

    for (const operation of pendingOperations) {
      try {
        const { id, type, table, data } = operation;

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

  const deleteItem = useCallback(
      async (id: string) => {
        try {
          console.log(`Attempting to delete item with ID: ${id}`);

          const removeItem = (
              items: ExtendedTreeItem[],
              idToRemove: string,
          ): ExtendedTreeItem[] => {
            return items
                .filter((item) => item.id !== idToRemove)
                .map((item) => ({
                  ...item,
                  children: item.children
                      ? removeItem(item.children, idToRemove)
                      : undefined,
                }));
          };

          const itemToDelete = sampleGroupData[id];

          if (itemToDelete) {
            if (navigator.onLine) {
              // Handle online deletion
              const storageFolderPath = itemToDelete.storage_folder;
              const humanReadableSampleId = itemToDelete.human_readable_sample_id;

              // Delete raw data files
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

              // Delete from Supabase
              await deleteData('sample_group_metadata', { id });
            } else {
              // Queue deletion for when back online
              const pendingOperation = {
                type: 'delete',
                table: 'sample_group_metadata',
                data: { id },
              };
              await addPendingOperation(pendingOperation);
            }

            // Update local state
            await deleteSampleGroup(id);
            setSampleGroupData((prev) => {
              const newData = { ...prev };
              delete newData[id];
              if (window?.electron?.store) {
                window.electron.store.set('sampleGroupData', newData);
              }
              return newData;
            });

            // Clean up local storage if using electron
            if (window?.electron?.store) {
              const humanReadableSampleId = itemToDelete.human_readable_sample_id;
              const sampleMetadataEntries = await fetchSampleMetadataEntries(
                  humanReadableSampleId,
              );
              for (const entry of sampleMetadataEntries) {
                const configId = entry.data_type;
                const localProcessedDataKey = `processedData_${humanReadableSampleId}_${configId}`;
                window.electron.store.delete(localProcessedDataKey);
              }
            }
          }

          setFileTreeData((prevFileTreeData) => removeItem(prevFileTreeData, id));
          await saveTreeData();
        } catch (error) {
          console.error(`Error deleting item with ID ${id}:`, error);
          throw error;
        }
      },
      [saveTreeData, setFileTreeData, setSampleGroupData, sampleGroupData],
  );

  useEffect(() => {
    if (userOrgId) {
      fetchSampleGroups();
      const unsubscribe = setupSubscriptions();
      return () => {
        unsubscribe && unsubscribe();
      };
    }
    // Load offline data
    const loadLocalData = async () => {
      const localGroups = await getAllSampleGroups();
      const groupData: Record<string, SampleGroup> = {};
      localGroups.forEach((group) => {
        groupData[group.id] = group;
      });
      setSampleGroupData(groupData);
    };
    loadLocalData();
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
    if (window?.electron?.store?.get('fileTreeDataChanges')) {
      await saveTreeData();
    }
    await processPendingOperations();
  }, [saveTreeData, processPendingOperations]);

  const isOnline = useOnlineStatus(synchronizeData);

  return (
      <DataContext.Provider
          value={{
            fileTreeData: fileTreeData || [],
            setFileTreeData,
            sampleGroupData,
            setSampleGroupData,
            addItem,
            deleteItem,
            isSyncing,
            locations,
            isOnline,
          }}
      >
        {children}
      </DataContext.Provider>
  );
};

export default DataProvider;
