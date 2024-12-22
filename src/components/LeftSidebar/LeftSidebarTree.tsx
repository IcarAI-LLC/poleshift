//src/components/LeftSidebar/LeftSidebarTree.tsx
import React, {useCallback, useEffect, useRef} from 'react';
import Box from '@mui/material/Box';
import {Folder as FolderIcon, FolderOpen as FolderOpenIcon, Science as ScienceIcon, Block as ExcludedIcon} from '@mui/icons-material';
import PenguinIcon from '../../assets/penguin.svg';
import {styled} from '@mui/material/styles';
import {RichTreeView} from '@mui/x-tree-view/RichTreeView';
import {useTreeItem2, UseTreeItem2Parameters} from '@mui/x-tree-view/useTreeItem2';
import {
    TreeItem2Content,
    TreeItem2GroupTransition,
    TreeItem2IconContainer,
    TreeItem2Label,
    TreeItem2Root,
} from '@mui/x-tree-view/TreeItem2';
import {TreeItem2Icon} from '@mui/x-tree-view/TreeItem2Icon';
import {TreeItem2Provider} from '@mui/x-tree-view/TreeItem2Provider';
import {useData, useUI} from '../../lib/hooks';
import {FileNode, FileNodeType} from '../../lib/types';

const CustomTreeItemContent = styled(TreeItem2Content)(({ theme }) => ({
    padding: theme.spacing(0.5, 1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

interface CustomTreeItemProps
    extends Omit<UseTreeItem2Parameters, 'rootRef'>,
        Omit<React.HTMLAttributes<HTMLLIElement>, 'onFocus'> {}

// Make sure `props` only has `itemId`, not a separate `id`.
const CustomTreeItem = React.forwardRef(function CustomTreeItem(
    props: CustomTreeItemProps,
    ref: React.Ref<HTMLLIElement>,
) {
    // Notice we no longer destructure `id`.
    // We just use `itemId, label, disabled, children, ...other`.
    const { itemId, label, disabled, children, ...other } = props;

    const {
        getRootProps,
        getContentProps,
        getIconContainerProps,
        getLabelProps,
        getGroupTransitionProps,
        status,
        publicAPI,
    } = useTreeItem2({
        itemId,
        label,
        disabled,
        children,
        rootRef: ref,
    });

    // This is the correct item corresponding to itemId
    const item = publicAPI.getItem(itemId) as FileNode;
    const isFolder = item.type === 'folder';
    const isSampleGroup = item.type === FileNodeType.SampleGroup;

    const { handleLeftSidebarContextMenu } = useUI();
    const contentProps = getContentProps();

    return (
        <TreeItem2Provider itemId={itemId}>
            <TreeItem2Root {...getRootProps({ ...other })}>
                {/* Attach onContextMenu here instead of the root */}
                <CustomTreeItemContent
                    {...contentProps}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLeftSidebarContextMenu(e, itemId);
                    }}
                >
                    <TreeItem2IconContainer {...getIconContainerProps()}>
                        <TreeItem2Icon status={status} />
                    </TreeItem2IconContainer>
                    <Box sx={{ flexGrow: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                        {isSampleGroup && <ScienceIcon sx={{ color: 'cyan' }} />}
                        {isFolder && (status.expanded ? <FolderOpenIcon /> : <FolderIcon />)}
                        <TreeItem2Label {...getLabelProps()} />
                    </Box>
                </CustomTreeItemContent>

                {children && <TreeItem2GroupTransition {...getGroupTransitionProps()} />}
            </TreeItem2Root>
        </TreeItem2Provider>
    );
});


const LeftSidebarTree: React.FC = () => {
    const {
        selectedLeftItem,
        setSelectedLeftItem,
        leftSidebarContextMenu,
        closeLeftSidebarContextMenu,
        setErrorMessage,
    } = useUI();

    const { fileTree, deleteNode } = useData();
    const contextMenuRef = useRef<HTMLDivElement>(null);
    console.log(fileTree);

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

    const handleDeleteSample = useCallback(async () => {
        if (!leftSidebarContextMenu.itemId) {
            setErrorMessage('Could not determine which item to delete.');
            return;
        }
        try {
            await deleteNode(leftSidebarContextMenu.itemId);
            closeLeftSidebarContextMenu();
            if (selectedLeftItem?.id === leftSidebarContextMenu.itemId) {
                setSelectedLeftItem(undefined);
            }
        } catch (error: any) {
            setErrorMessage(error.message || 'An error occurred while deleting the item.');
        }
    }, [
        leftSidebarContextMenu.itemId,
        deleteNode,
        closeLeftSidebarContextMenu,
        setErrorMessage,
        selectedLeftItem,
        setSelectedLeftItem
    ]);

    const handleSelect = useCallback(
        (_event: React.SyntheticEvent, itemId: string | null) => {
            if (!itemId) {
                setSelectedLeftItem(undefined);
                return;
            }

            const findNodeById = (nodes: FileNode[]): FileNode | undefined => {
                for (const node of nodes) {
                    if (node.id === itemId) return node;
                    if (node.children) {
                        const found = findNodeById(node.children);
                        if (found) return found;
                    }
                }
                return undefined;
            };

            const selectedNode = findNodeById(fileTree || []);
            setSelectedLeftItem(selectedNode);
        },
        [fileTree, setSelectedLeftItem]
    );

    if (!fileTree || fileTree.length === 0) {
        return (
            <div className="sidebar__content sidebar__content--empty">
                No items to display
            </div>
        );
    }

    return (
        <div className="sidebar__content">
            <Box sx={{ minHeight: 352, minWidth: 250 }}>
                <RichTreeView<FileNode>
                    items={fileTree}
                    slots={{ item: CustomTreeItem }}
                    getItemId={(item) => item.id}      // Each FileNode's .id becomes the itemId
                    getItemLabel={(item) => item.name} // For labeling
                    selectedItems={selectedLeftItem?.id || null}
                    onSelectedItemsChange={handleSelect}
                    aria-label="file system navigator"
                />
            </Box>

            {leftSidebarContextMenu.isVisible && (
                <div
                    ref={contextMenuRef}
                    className="context-menu"
                    style={{
                        top: leftSidebarContextMenu.y,
                        left: leftSidebarContextMenu.x,
                        position: 'absolute',
                        zIndex: 1000,
                    }}
                >
                    <div className="context-menu-item" onClick={handleDeleteSample}>
                        Delete Sample
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeftSidebarTree;
