// useFileTreeData.ts

import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import {
  fetchData,
  upsertData,
  subscribeToTable,
  removeSubscription,
} from '../utils/supabaseUtils';
import useAuth from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { TreeItem } from '../components/LeftSidebar/LeftSidebarTree.tsx';
import { load } from '@tauri-apps/plugin-store';

const buildTree = (
    nodes: TreeItem[],
    parentId: string | null,
): TreeItem[] => {
  return nodes
      .filter((node) => node.parent_id === parentId)
      .map((node) => ({
        ...node,
        children: buildTree(nodes, node.id),
      }));
};

export const useFileTreeData = () => {
  const { user, userOrgId } = useAuth();
  const [fileTreeData, setFileTreeData] = useState<TreeItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Load tree data from the database
  const loadTreeData = useCallback(async () => {
    if (!user || !userOrgId) return;

    try {
      // Fetch folders from 'file_nodes' table
      const folderData = await fetchData('file_nodes', { org_id: userOrgId });

      const folders: TreeItem[] = folderData.map((node: any) => ({
        id: node.id,
        text: node.name,
        droppable: true,
        type: 'folder',
        parent_id: node.parent_id || null,
      }));

      // Fetch sampleGroups from 'sample_group_metadata' table
      const sampleGroupData = await fetchData('sample_group_metadata', {
        org_id: userOrgId,
      });

      const sampleGroups: TreeItem[] = sampleGroupData.map((sg: any) => ({
        id: sg.id,
        text: sg.human_readable_sample_id,
        droppable: false,
        type: 'sampleGroup',
        parent_id: sg.parent_id || null, // Ensure this field exists in your schema
      }));

      // Combine folders and sampleGroups
      const allNodes = [...folders, ...sampleGroups];

      // Build the tree structure
      const tree = buildTree(allNodes, null);
      setFileTreeData(tree);

      // Store in Tauri store
      const store = await load('fileTreeData.json', { autoSave: false, createNew: true });
      await store.set('fileTreeData', tree);
      await store.save();
    } catch (error) {
      console.error('Error loading tree data:', error);
      // Load from Tauri store
      const store = await load('fileTreeData.json', { autoSave: false, createNew: true });
      const localData = await store.get<TreeItem[]>('fileTreeData');
      setFileTreeData(localData || []);
    }
  }, [user, userOrgId]);

  // Save tree data to the database
  const saveTreeData = useCallback(
      async (updatedNodes: TreeItem[]) => {
        if (!user || !userOrgId || !updatedNodes) return;

        setIsSyncing(true);

        try {
          // Separate folders and sampleGroups
          const folders = updatedNodes.filter((node) => node.type === 'folder');
          const sampleGroups = updatedNodes.filter(
              (node) => node.type === 'sampleGroup',
          );

          // Save folders to 'file_nodes' table
          await Promise.all(
              folders.map((folder) =>
                  upsertData(
                      'file_nodes',
                      {
                        id: folder.id,
                        name: folder.text,
                        type: 'folder',
                        parent_id: folder.parent_id,
                        org_id: userOrgId,
                      },
                      'id',
                  ),
              ),
          );

          // Save sampleGroups' parent_id to 'sample_group_metadata' table
          await Promise.all(
              sampleGroups.map((sg) =>
                  upsertData(
                      'sample_group_metadata',
                      {
                        id: sg.id,
                        parent_id: sg.parent_id,
                      },
                      'id',
                  ),
              ),
          );

          // Clear changes flag in Tauri store and save the latest tree
          const store = await load('fileTreeData.json', { autoSave: false, createNew: true });
          await store.delete('fileTreeDataChanges');
          await store.set('fileTreeData', fileTreeData);
          await store.save();
        } catch (error) {
          console.error('Error saving tree data:', error);
          // Set changes flag in Tauri store and save the latest tree
          const store = await load('fileTreeData.json', { autoSave: false, createNew: true });
          await store.set('fileTreeDataChanges', true);
          await store.set('fileTreeData', fileTreeData);
          await store.save();
        } finally {
          setIsSyncing(false);
        }
      },
      [user, userOrgId, fileTreeData],
  );

  const debouncedSaveTreeData = useCallback(
      debounce((updatedNodes: TreeItem[]) => saveTreeData(updatedNodes), 500),
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
          nodes: TreeItem[],
          parentId: string | null,
          result: TreeItem[],
      ) => {
        nodes.forEach((node) => {
          result.push({
            ...node,
            parent_id: parentId,
          });
          if (node.children) flattenTree(node.children, node.id, result);
        });
      };

      const flatNodes: TreeItem[] = [];
      flattenTree(fileTreeData, null, flatNodes);

      debouncedSaveTreeData(flatNodes);
    }
    return () => {
      debouncedSaveTreeData.cancel();
    };
  }, [fileTreeData, debouncedSaveTreeData, user, userOrgId]);

  const synchronizeData = useCallback(async () => {
    const store = await load('fileTreeData.json', { autoSave: false, createNew: true });
    const hasChanges = await store.get<boolean>('fileTreeDataChanges');
    if (hasChanges) {
      const localData = await store.get<TreeItem[]>('fileTreeData');
      const flatNodes: TreeItem[] = [];
      const flattenTree = (nodes: TreeItem[], parentId: string | null) => {
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
