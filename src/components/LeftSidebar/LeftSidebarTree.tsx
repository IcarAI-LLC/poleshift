// lib/components/LeftSidebarTree.tsx
import React, { useCallback } from 'react';
import { Tree, NodeApi, CursorProps } from 'react-arborist';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Science as ScienceIcon
} from '@mui/icons-material';

import { useUI } from '../../lib/hooks';
import { useData } from '../../lib/hooks';
import { FileTreeService } from '../../lib/services/FileTreeService';
import CustomCursor from './CustomCursor';
import type { TreeItem } from '../../lib/types';

const LeftSidebarTree: React.FC = () => {
  const {
    selectedLeftItem,
    setSelectedLeftItem,
    setContextMenuState,
    setErrorMessage,
  } = useUI();

  const { fileTree, isSyncing } = useData();

  const handleMove = useCallback(async ({
                                          dragIds,
                                          parentId,
                                        }: {
    dragIds: string[];
    parentId: string | null;
    index: number;
  }) => {
    try {
      const dragId = dragIds[0];
      if (!dragId) return;

      let nodeToMove: TreeItem | null = null;

      const findNode = (nodes: TreeItem[] | null): TreeItem | null => {
        if (!nodes) return null;
        for (const node of nodes) {
          if (node.id === dragId) return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      nodeToMove = findNode(fileTree);
      if (!nodeToMove) {
        throw new Error('Node to move not found');
      }

      await FileTreeService.moveNode(dragId, parentId);
    } catch (error: any) {
      console.error('Error during drag and drop:', error);
      setErrorMessage(error.message || 'An error occurred while moving items.');
    }
  }, [fileTree, setErrorMessage]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: NodeApi<TreeItem>) => {
    e.preventDefault();
    setSelectedLeftItem(node.data);
    setContextMenuState({
      isVisible: true,
      x: e.pageX,
      y: e.pageY,
      itemId: node.data.id
    });
  }, [setSelectedLeftItem, setContextMenuState]);

  const disableDrag = useCallback(() => isSyncing, [isSyncing]);

  const disableDrop = useCallback(
      (args: { parentNode: NodeApi<TreeItem> | null }) =>
          args.parentNode?.data.type === 'sampleGroup' || isSyncing,
      [isSyncing]
  );

  const onSelect = useCallback(
      (nodes: NodeApi<TreeItem>[]) => {
        if (nodes.length > 0) {
          setSelectedLeftItem(nodes[0].data);
        } else {
          setSelectedLeftItem(null);
        }
      },
      [setSelectedLeftItem]
  );

  const Node = React.memo(({
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

        const handleClick = (e: React.MouseEvent) => {
          node.handleClick(e);
          setSelectedLeftItem(node.data);
          if (isFolder) {
            node.toggle();
          }
        };

        const nodeClassNames = [
          'tree-node',
          isSelected ? 'tree-node--selected' : '',
          isFolder ? 'tree-node--folder' : '',
          isSampleGroup ? 'tree-node--sampleGroup' : '',
          isSyncing ? 'tree-node--disabled' : ''
        ].filter(Boolean).join(' ');

        return (
            <div
                ref={dragHandle}
                className={nodeClassNames}
                style={style}
                onClick={handleClick}
                onContextMenu={(e) => handleContextMenu(e, node)}
            >
              <div className="tree-node__icon">
                {isFolder ? (
                    node.isOpen ? <FolderOpenIcon /> : <FolderIcon />
                ) : isSampleGroup ? (
                    <ScienceIcon />
                ) : null}
              </div>
              <div className="tree-node__text">{node.data.text}</div>
            </div>
        );
      }, (prevProps, nextProps) =>
          prevProps.node.data === nextProps.node.data &&
          prevProps.style === nextProps.style
  );

  if (!fileTree?.length) {
    return (
        <div className="sidebar__content sidebar__content--empty">
          No items to display
        </div>
    );
  }

  return (
      <div className="sidebar__content">
        <Tree
            data={fileTree}
            onMove={handleMove}
            onSelect={onSelect}
            selection={selectedLeftItem?.id}
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