// src/components/LeftSidebarTree.tsx

import React, { useCallback, useRef, useEffect } from 'react';
import { Tree, NodeApi, CursorProps } from 'react-arborist';
import {
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    Science as ScienceIcon,
} from '@mui/icons-material';
import { useUI } from '../../lib/hooks';
import { useData } from '../../lib/hooks';
import CustomCursor from './CustomCursor';
import type { FileNode } from '../../lib/types';

const LeftSidebarTree: React.FC = () => {
    const {
        selectedLeftItem,
        setSelectedLeftItem,
        leftSidebarContextMenu,
        handleLeftSidebarContextMenu,
        closeLeftSidebarContextMenu,
        setErrorMessage,
    } = useUI();

    const contextMenuRef = useRef<HTMLDivElement>(null);

    const { fileTree, updateFileTree, isSyncing, deleteNode } = useData();

    const handleMove = useCallback(
        async ({
                   dragIds,
                   parentId,
                   index,
               }: {
            dragIds: string[];
            parentId: string | null;
            index: number;
        }) => {
            try {
                const dragId = dragIds[0];
                if (!dragId) return;

                // Your existing move logic here...

                // Update the file tree
                await updateFileTree(finalTreeData);
            } catch (error) {
                console.error('Error during drag and drop:', error);
                setErrorMessage('An error occurred while moving items.');
            }
        },
        [fileTree, updateFileTree, setErrorMessage]
    );

    const handleDeleteSample = useCallback(async () => {
        if (!leftSidebarContextMenu.itemId) {
            setErrorMessage('Could not determine which item to delete.');
            return;
        }
        try {
            await deleteNode(leftSidebarContextMenu.itemId);
            closeLeftSidebarContextMenu();
        } catch (error: any) {
            setErrorMessage(
                error.message || 'An error occurred while deleting the item.'
            );
        }
    }, [
        leftSidebarContextMenu,
        deleteNode,
        closeLeftSidebarContextMenu,
        setErrorMessage,
    ]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                leftSidebarContextMenu.isVisible &&
                contextMenuRef.current &&
                !contextMenuRef.current.contains(e.target as Node)
            ) {
                closeLeftSidebarContextMenu();
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => {
            window.removeEventListener('click', handleClickOutside);
        };
    }, [leftSidebarContextMenu.isVisible, closeLeftSidebarContextMenu]);

    const disableDrag = useCallback(() => isSyncing, [isSyncing]);

    const disableDrop = useCallback(
        (args: { parentNode: NodeApi<FileNode> | null }) =>
            args.parentNode?.data.type === 'sampleGroup' || isSyncing,
        [isSyncing]
    );

    const onSelect = useCallback(
        (nodes: NodeApi<FileNode>[]) => {
            if (nodes.length > 0) {
                setSelectedLeftItem(nodes[0].data);
            } else {
                setSelectedLeftItem(null);
            }
        },
        [setSelectedLeftItem]
    );

    const Node = React.memo(
        ({
             node,
             style,
             dragHandle,
         }: {
            node: NodeApi<FileNode>;
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
                isSyncing ? 'tree-node--disabled' : '',
            ]
                .filter(Boolean)
                .join(' ');

            return (
                <div
                    ref={dragHandle}
                    className={nodeClassNames}
                    style={style}
                    onClick={handleClick}
                    onContextMenu={(e) => handleLeftSidebarContextMenu(e, node.data.id)}
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
                        ) : null}
                    </div>
                    <div className="tree-node__text">{node.data.name}</div>
                </div>
            );
        },
        (prevProps, nextProps) =>
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

            {leftSidebarContextMenu.isVisible && (
                <div
                    ref={contextMenuRef}
                    className="context-menu"
                    style={{
                        top: leftSidebarContextMenu.y,
                        left: leftSidebarContextMenu.x,
                        position: 'absolute',
                        zIndex: 1000, // Ensure the menu appears above other elements
                    }}
                >
                    <div className="context-menu-item" onClick={handleDeleteSample}>
                        Delete Sample
                    </div>
                    {/* Add more context menu items here if needed */}
                </div>
            )}
        </div>
    );
};

export default LeftSidebarTree;
