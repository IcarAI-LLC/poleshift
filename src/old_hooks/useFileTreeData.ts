// useFileTreeData.ts

import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import {
  fetchData,
  upsertData,
  subscribeToTable,
  removeSubscription,
} from '../old_utils/supabaseUtils';
import useAuth from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { TreeItem } from '../components/LeftSidebar/LeftSidebarTree.tsx';
import { load } from '@tauri-apps/plugin-store';
import {SampleGroup} from "../old_utils/sampleGroupUtils.ts";

// Define an extended TreeItem to include SampleGroup data
interface TreeItemWithSampleGroupData extends TreeItem {
  sampleGroupData?: SampleGroup;
  children?: TreeItemWithSampleGroupData[];
}

// Adjust the buildTree function to work with the extended TreeItem
const buildTree = (
    nodes: TreeItemWithSampleGroupData[],
    parentId: string | null,
): TreeItemWithSampleGroupData[] => {
  return nodes
      .filter((node) => node.parent_id === parentId)
      .map((node) => ({
        ...node,
        children: buildTree(nodes, node.id),
      }));
};

export const useFileTreeData = () => {
  const { user, userOrgId } = useAuth();
  const [fileTreeData, setFileTreeData] = useState<TreeItemWithSampleGroupData[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const store = load('fileTreeData20.json', { autoSave: false });

  // Load tree data from the database
  const loadTreeData = useCallback(async () => {
    if (!user || !userOrgId) return;

    try {
      // Fetch all nodes from 'file_nodes' table
      const nodeData = await fetchData('file_nodes', { org_id: userOrgId });

      // Map nodeData to TreeItems
      const nodes: TreeItemWithSampleGroupData[] = nodeData.map((node: any) => ({
        id: node.id,
        text: node.name,
        droppable: node.type === 'folder',
        type: node.type,
        parent_id: node.parent_id || null,
      }));

      // Get IDs of sampleGroups
      const sampleGroupIds = nodeData
          .filter((node: any) => node.type === 'sampleGroup')
          .map((node: any) => node.id);

      // Fetch SampleGroup data for sampleGroups
      let sampleGroupDataMap = new Map<string, SampleGroup>();
      if (sampleGroupIds.length > 0) {
        const sampleGroupData = await fetchData('sample_group_metadata', {
          id: sampleGroupIds,
        });

        // Create a map of sampleGroupData
        sampleGroupData.forEach((sg: SampleGroup) => {
          sampleGroupDataMap.set(sg.id, sg);
        });
      }

      // Attach SampleGroup data to nodes
      nodes.forEach((node) => {
        if (node.type === 'sampleGroup') {
          const sgData = sampleGroupDataMap.get(node.id);
          if (sgData) {
            node.sampleGroupData = sgData;
          }
        }
      });

      // Build the tree structure
      const tree = buildTree(nodes, null);
      setFileTreeData(tree);

      // Store in Tauri store
      await (await store).set('fileTreeData', tree);
      await (await store).save();
    } catch (error) {
      console.error('Error loading tree data:', error);
      // Load from Tauri store
      const localData = await (await store).get<TreeItemWithSampleGroupData[]>('fileTreeData');
      setFileTreeData(localData || []);
    }
  }, [user, userOrgId]);

  // Save tree data to the database
  const saveTreeData = useCallback(
      async (updatedNodes: TreeItemWithSampleGroupData[]) => {
        if (!user || !userOrgId || !updatedNodes) return;

        setIsSyncing(true);

        try {
          // Save all nodes (folders and sampleGroups) to 'file_nodes' table
          await Promise.all(
              updatedNodes.map((node) =>
                  upsertData(
                      'file_nodes',
                      {
                        id: node.id,
                        name: node.text,
                        type: node.type,
                        parent_id: node.parent_id,
                        org_id: userOrgId,
                      },
                      'id',
                  ),
              ),
          );

          // Save sampleGroups to 'sample_group_metadata' table with full data
          const sampleGroups = updatedNodes.filter(
              (node): node is TreeItemWithSampleGroupData => node.type === 'sampleGroup',
          );

          await Promise.all(
              sampleGroups.map((node) => {
                if (node.sampleGroupData) {
                  return upsertData('sample_group_metadata', node.sampleGroupData, 'id');
                } else {
                  console.warn(`No sampleGroupData for sampleGroup id ${node.id}`);
                  return Promise.resolve();
                }
              }),
          );

          // Clear changes flag in Tauri store and save the latest tree
          await (await store).delete('fileTreeDataChanges');
          await (await store).set('fileTreeData', fileTreeData);
          await (await store).save();
        } catch (error) {
          console.error('Error saving tree data:', error);
          // Set changes flag in Tauri store and save the latest tree
          await (await store).set('fileTreeDataChanges', true);
          await (await store).set('fileTreeData', fileTreeData);
          await (await store).save();
        } finally {
          setIsSyncing(false);
        }
      },
      [user, userOrgId, fileTreeData],
  );

  const debouncedSaveTreeData = useCallback(
      debounce((updatedNodes: TreeItemWithSampleGroupData[]) => saveTreeData(updatedNodes), 500),
      [saveTreeData],
  );

  useEffect(() => {
    if (user && userOrgId) {
      loadTreeData();
    }
  }, [loadTreeData, user, userOrgId]);

  useEffect(() => {
    if (user && userOrgId && fileTreeData !== null) {
      const flattenTree = (
          nodes: TreeItemWithSampleGroupData[],
          parentId: string | null,
          result: TreeItemWithSampleGroupData[],
      ) => {
        nodes.forEach((node) => {
          result.push({
            ...node,
            parent_id: parentId,
          });
          if (node.children) flattenTree(node.children, node.id, result);
        });
      };

      const flatNodes: TreeItemWithSampleGroupData[] = [];
      flattenTree(fileTreeData, null, flatNodes);

      debouncedSaveTreeData(flatNodes);
    }
    return () => {
      debouncedSaveTreeData.cancel();
    };
  }, [fileTreeData, debouncedSaveTreeData, user, userOrgId]);

  const synchronizeData = useCallback(async () => {
    const hasChanges = await (await store).get<boolean>('fileTreeDataChanges');
    if (hasChanges) {
      const localData = await (await store).get<TreeItemWithSampleGroupData[]>('fileTreeData');
      const flatNodes: TreeItemWithSampleGroupData[] = [];
      const flattenTree = (nodes: TreeItemWithSampleGroupData[], parentId: string | null) => {
        nodes.forEach((node) => {
          flatNodes.push({
            ...node,
            parent_id: parentId,
          });
          if (node.children) flattenTree(node.children, node.id);
        });
      };
      flattenTree(localData || [], null);
      await saveTreeData(flatNodes);
    }
  }, [saveTreeData]);

  // Use the useOnlineStatus hook
  useOnlineStatus(synchronizeData);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !userOrgId || !window.navigator.onLine) return;

    const fileNodesChannel = subscribeToTable(
        'file_nodes',
        { org_id: userOrgId },
        (payload) => {
          if (['UPDATE', 'INSERT', 'DELETE'].includes(payload.eventType)) {
            loadTreeData();
          }
        },
    );

    const sampleGroupChannel = subscribeToTable(
        'sample_group_metadata',
        { org_id: userOrgId },
        (payload) => {
          if (['UPDATE', 'INSERT', 'DELETE'].includes(payload.eventType)) {
            loadTreeData();
          }
        },
    );

    return () => {
      removeSubscription(fileNodesChannel);
      removeSubscription(sampleGroupChannel);
    };
  }, [user, userOrgId, loadTreeData]);

  return { fileTreeData, setFileTreeData, isSyncing };
};
