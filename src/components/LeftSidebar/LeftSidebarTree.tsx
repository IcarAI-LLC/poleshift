// src/renderer/components/LeftSidebar/LeftSidebarTree.tsx

import React, { useCallback, startTransition } from 'react';
import { Tree, NodeApi, CursorProps } from 'react-arborist';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ScienceIcon from '@mui/icons-material/Science';
import useUI from '../../hooks/useUI';
import CustomCursor from './CustomCursor';
import useData from '../../hooks/useData';

interface TreeItem {
  id: string;
  text: string;
  droppable: boolean;
  type: 'folder' | 'sampleGroup' | string;
  dropBoxHasData?: string[]; // Add this line
  children?: TreeItem[];
}

const LeftSidebarTree: React.FC = () => {
  const {
    selectedLeftItem,
    setSelectedLeftItem,
    setContextMenuState,
    setErrorMessage,
  } = useUI();

  const { fileTreeData, setFileTreeData } = useData(); // Access fileTreeData from context
  // Handle node movement (drag and drop)
  const handleMove = useCallback(
    ({
      dragIds,
      parentId,
      index,
    }: {
      dragIds: string[];
      parentId: string | null;
      index: number;
    }) => {
      try {
        const dragId = dragIds[0]; // Assuming single node drag-and-drop
        if (!dragId) return;

        let nodeToMove: TreeItem | null = null;

        // Function to find the node to move
        const findNode = (nodes: TreeItem[]): TreeItem | null => {
          for (const node of nodes) {
            if (node.id === dragId) {
              return node;
            }
            if (node.children) {
              const found = findNode(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        nodeToMove = findNode(fileTreeData);
        if (!nodeToMove) {
          throw new Error('Node to move not found');
        }

        // Remove the node from its current location
        const removeNode = (nodes: TreeItem[]): TreeItem[] => {
          return nodes
            .filter((node) => node.id !== dragId)
            .map((node) => ({
              ...node,
              children: node.children ? removeNode(node.children) : undefined,
            }));
        };

        const updatedTreeData = removeNode(fileTreeData);

        // Insert the node at the new location
        const insertNode = (nodes: TreeItem[]): TreeItem[] => {
          return nodes.map((node) => {
            if (node.id === parentId) {
              const newChildren = node.children ? [...node.children] : [];
              newChildren.splice(index, 0, nodeToMove!);
              return {
                ...node,
                children: newChildren,
              };
            }
            if (node.children) {
              return {
                ...node,
                children: insertNode(node.children),
              };
            }
            return node;
          });
        };

        let finalTreeData: TreeItem[];

        if (parentId === null) {
          // Insert at root level
          finalTreeData = [
            ...updatedTreeData.slice(0, index),
            nodeToMove,
            ...updatedTreeData.slice(index),
          ];
        } else {
          finalTreeData = insertNode(updatedTreeData);
        }

        // Use startTransition to defer the state update
        startTransition(() => {
          setFileTreeData(finalTreeData);
        });
      } catch (error) {
        console.error('Error during drag and drop:', error);
        setErrorMessage('An error occurred while moving items.');
      }
    },
    [fileTreeData, setFileTreeData, setErrorMessage],
  );

  // Memoize disableDrag and disableDrop functions
  const disableDrag = useCallback(() => false, []);
  const disableDrop = useCallback(
    ({ parentNode }) => parentNode?.data.type === 'sampleGroup',
    [],
  );

  // Memoize onSelect function
  const onSelect = useCallback(
    (nodes: NodeApi<TreeItem>[]) => {
      if (nodes.length > 0) {
        setSelectedLeftItem(nodes[0].data); // Update this line
      } else {
        setSelectedLeftItem(null);
      }
    },
    [setSelectedLeftItem],
  );

  // Define the Node component for rendering each node
  const Node = React.memo(
    ({
      node,
      style,
      dragHandle,
    }: {
      node: NodeApi<TreeItem>;
      style: React.CSSProperties;
      dragHandle?: (el: HTMLDivElement | null) => void;
    }) => {
      const isSelected = selectedLeftItem && selectedLeftItem.id === node.id;
      const isFolder = node.data.type === 'folder';
      const isSampleGroup = node.data.type === 'sampleGroup';

      // Inside Node component
      const handleClick = (e: React.MouseEvent) => {
        node.handleClick(e);
        setSelectedLeftItem(node.data); // Now node contains all properties
        if (isFolder) {
          node.toggle();
        }
      };

      const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setSelectedLeftItem(node.data);
        setContextMenuState({
          isVisible: true,
          x: e.pageX,
          y: e.pageY,
          itemId: node.data.id,
        });
      };

      const nodeClassNames = [
        'tree-node',
        isSelected ? 'tree-node--selected' : '',
        isFolder
          ? 'tree-node--folder'
          : isSampleGroup
            ? 'tree-node--sampleGroup'
            : 'tree-node--file',
      ]
        .join(' ')
        .trim();

      return (
        <div
          ref={dragHandle}
          className={nodeClassNames}
          style={style}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <div className="tree-node__icon">
            {isFolder ? (
              node.isOpen ? (
                <FolderOpenIcon />
              ) : (
                <FolderIcon />
              )
            ) : isSampleGroup ? (
              <ScienceIcon />
            ) : (
              <FolderIcon /> // Change this icon if necessary
            )}
          </div>
          <div className="tree-node__text">{node.data.text}</div>
        </div>
      );
    },
    (prevProps, nextProps) =>
      prevProps.node.data === nextProps.node.data &&
      prevProps.style === nextProps.style,
  );

  // Check if fileTreeData is populated
  if (!fileTreeData || fileTreeData.length === 0) {
    return <div className="sidebar__content">No data to display.</div>;
  }

  return (
    <div className="sidebar__content">
      <Tree
        data={fileTreeData}
        onMove={handleMove}
        onSelect={onSelect}
        selection={selectedLeftItem ? selectedLeftItem.id : undefined}
        disableDrag={disableDrag}
        disableDrop={disableDrop}
        rowHeight={36}
        indent={24}
        renderCursor={(props: CursorProps) => <CustomCursor {...props} />}
      >
        {Node}
      </Tree>
    </div>
  );
};

export default LeftSidebarTree;
