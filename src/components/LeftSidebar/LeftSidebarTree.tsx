// src/components/LeftSidebar/LeftSidebarTree.tsx
import React, {useCallback, useEffect, useRef} from 'react';
import Box from '@mui/material/Box';
import {styled} from '@mui/material/styles';
import {
    Block as ExcludedIcon,
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    Science as ScienceIcon,
} from '@mui/icons-material';
import PenguinIcon from '../../assets/penguin.svg';
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
import {FileNodeWithChildren} from '../../lib/hooks/useData.ts'; // or wherever it’s defined
import ContainerIcon from '../../assets/container.svg'
import {FileNodeType, ProximityCategory} from "@/lib/powersync/DrizzleSchema.ts";

const CustomTreeItemContent = styled(TreeItem2Content)(({ theme }) => ({
    padding: theme.spacing(0.5, 1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

interface CustomTreeItemProps
    extends Omit<UseTreeItem2Parameters, 'rootRef'>,
        Omit<React.HTMLAttributes<HTMLLIElement>, 'onFocus'> {}

const CustomTreeItem = React.forwardRef(function CustomTreeItem(
    props: CustomTreeItemProps,
    ref: React.Ref<HTMLLIElement>,
) {
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

    const { sampleGroups } = useData(); // or sampleGroupMap, depending on your structure

    // The actual item in the tree
    const item = publicAPI.getItem(itemId) as FileNodeWithChildren;
    const isFolder = item.type === FileNodeType.Folder;
    const isSampleGroup = item.type === FileNodeType.SampleGroup;
    const isContainer = item.type === FileNodeType.Container;

    // Find the associated SampleGroup (if any)
    const sampleGroup = React.useMemo(() => {
        if (!isSampleGroup || !item.sample_group_id || !sampleGroups) return undefined;
        return sampleGroups[item.sample_group_id];
    }, [isSampleGroup, item.sample_group_id, sampleGroups]);

    const { handleLeftSidebarContextMenu } = useUI();
    const contentProps = getContentProps();

    // Helper for labeling proximity
    const getProximityLabel = (category?: ProximityCategory | null) => {
        switch (category) {
            case ProximityCategory.Close:
                return 'Close';
            case ProximityCategory.Far1:
                return 'Far1';
            case ProximityCategory.Far2:
                return 'Far2';
            default:
                return null;
        }
    };

    const proximityLabel = getProximityLabel(sampleGroup?.proximity_category as ProximityCategory || null);

    return (
        <TreeItem2Provider itemId={itemId}>
            <TreeItem2Root {...getRootProps({ ...other })}>
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
                        {/* Folder Icons */}
                        {isFolder && (status.expanded ? <FolderOpenIcon /> : <FolderIcon />)}
                        {isContainer ? <img
                            src={ContainerIcon}
                            alt="Container Icon"
                            style={{width: 24, height: 24}}
                        /> : null}

                        {/* Sample Group Icons */}
                        {isSampleGroup && sampleGroup && (
                            sampleGroup.excluded === 1 ? (
                                <ExcludedIcon sx={{ color: 'red' }} />
                            ) : sampleGroup.penguin_present === 1 ? (
                                <img
                                    src={PenguinIcon}
                                    alt="Penguin Icon"
                                    style={{ width: 24, height: 24 }}
                                />
                            ) : (
                                <ScienceIcon sx={{ color: 'cyan' }} />
                            )
                        )}

                        {/* The tree item label text */}
                        <TreeItem2Label {...getLabelProps()} />

                        {/* Conditionally show the greyed-out proximity text to the right */}
                        {isSampleGroup && proximityLabel && (
                            <Box
                                component="span"
                                sx={{ color: 'text.secondary', fontSize: '0.85rem', ml: 1 }}
                            >
                                {proximityLabel}
                            </Box>
                        )}
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

            const findNodeById = (nodes: FileNodeWithChildren[]): FileNodeWithChildren | undefined => {
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
                <RichTreeView<FileNodeWithChildren>
                    items={fileTree}
                    slots={{ item: CustomTreeItem }}
                    getItemId={(item) => item.id}
                    getItemLabel={(item) => item.name}
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
