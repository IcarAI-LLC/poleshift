import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import {
  fetchData,
  upsertData,
  subscribeToTable,
  removeSubscription, deleteData
} from '../utils/supabaseUtils';
import useAuth from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';

export interface ExtendedTreeItem {
  id: string;
  text: string;
  droppable: boolean;
  type: 'folder' | 'sampleGroup' | string;
  children?: ExtendedTreeItem[];
  dropBoxHasData?: string[];
}

const buildTree = (
  nodes: any[],
  parentId: string | null,
): ExtendedTreeItem[] => {
  return nodes
    .filter((node) => node.parent_id === parentId)
    .map((node) => ({
      id: node.id,
      text: node.name,
      droppable: node.type === 'folder',
      type: node.type,
      children: buildTree(nodes, node.id), // Recursively build children
    }));
};

export const useFileTreeData = () => {
  const { user, userOrgId } = useAuth();
  const [fileTreeData, setFileTreeData] = useState<ExtendedTreeItem[] | null>(
    null,
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Load tree data from the database
  const loadTreeData = useCallback(async () => {
    if (!user || !userOrgId) return;

    try {
      const data = await fetchData('file_nodes', { org_id: userOrgId });
      const tree = buildTree(data, null); // Build the tree from flat data
      setFileTreeData(tree);
      window.electron.store.set('fileTreeData', tree);
    } catch (error) {
      console.error('Error loading tree data:', error);
      const localData = window.electron.store.get('fileTreeData');
      setFileTreeData(localData || []);
    }
  }, [user, userOrgId]);

  // Save tree data to the database
  const saveTreeData = useCallback(
    async (updatedNodes: any[]) => {
      if (!user || !userOrgId || !updatedNodes) return;

      setIsSyncing(true);

      try {
        // Fetch all existing nodes from the database
        const existingNodes = await fetchData('file_nodes', { org_id: userOrgId });
        const existingNodeIds = new Set(existingNodes.map((node) => node.id));

        // Extract updated node IDs
        const updatedNodeIds = new Set(updatedNodes.map((node) => node.id));

        // Determine which nodes have been deleted
        const deletedNodeIds = Array.from(existingNodeIds).filter(
          (id) => !updatedNodeIds.has(id),
        );

        // Perform deletions
        if (deletedNodeIds.length > 0) {
          await Promise.all(
            deletedNodeIds.map((id) => deleteData('file_nodes', { id })),
          );
        }

        // Upsert updated nodes
        await Promise.all(
          updatedNodes.map(async (node) => {
            const existingNode = await fetchData('file_nodes', { id: node.id });

            if (
              existingNode &&
              existingNode[0]?.version !== undefined &&
              existingNode[0]?.version > node.version
            ) {
              // Conflict detected, handle resolution
              console.warn('Conflict detected for node:', node.id);

              // Strategy: Always prefer the latest version in the database
              node = {
                ...node,
                ...existingNode[0], // Overwrite local changes with the latest data
              };
            }

            // Upsert the resolved node
            return upsertData('file_nodes', node, 'id');
          }),
        );

        window.electron.store.delete('fileTreeDataChanges');
      } catch (error) {
        console.error('Error saving tree data:', error);
        window.electron.store.set('fileTreeDataChanges', true);
      } finally {
        setIsSyncing(false);
      }
    },
    [user, userOrgId],
  );

  const debouncedSaveTreeData = useCallback(
    debounce((updatedNodes: any[]) => saveTreeData(updatedNodes), 500),
    [saveTreeData],
  );

  useEffect(() => {
    if (user && userOrgId) {
      loadTreeData();
    }
  }, [loadTreeData, user, userOrgId]);

  useEffect(() => {
    if (user && userOrgId && fileTreeData !== null) {
      const flatNodes: { id: string; name: string; type: string; parent_id: string | null; org_id: string; }[] = []; // Flatten tree structure for saving
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
      debouncedSaveTreeData(flatNodes);
    }
    return () => {
      debouncedSaveTreeData.cancel();
    };
  }, [fileTreeData, debouncedSaveTreeData, user, userOrgId]);

  const synchronizeData = useCallback(async () => {
    if (window.electron.store.get('fileTreeDataChanges')) {
      const localData = window.electron.store.get('fileTreeData');
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
      flattenTree(localData || [], null);
      await saveTreeData(flatNodes);
    }
  }, [saveTreeData, userOrgId]);

  // Use the useOnlineStatus hook
  useOnlineStatus(synchronizeData);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !userOrgId || !window.navigator.onLine) return;

    const channel = subscribeToTable(
      'file_nodes',
      { org_id: userOrgId },
      (payload) => {
        if (['UPDATE', 'INSERT', 'DELETE'].includes(payload.eventType)) {
          loadTreeData();
        }
      },
    );

    return () => {
      removeSubscription(channel);
    };
  }, [user, userOrgId, loadTreeData]);

  return { fileTreeData, setFileTreeData, isSyncing };
};
