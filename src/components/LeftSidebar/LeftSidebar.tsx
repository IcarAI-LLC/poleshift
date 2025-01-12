import { useCallback, useState } from "react";
import {
    SidebarProvider,
    Sidebar,
    SidebarRail,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
} from "@/components/ui/sidebar";

import { Button } from "@/components/ui/button";
import {
    PlusCircle,
    FolderPlus,
    Globe2,
    DatabaseIcon,
    FlaskConical,
    Ban,
    Menu,
    Folder as FolderClosedIcon,
    FolderOpen as FolderOpenIcon,
    FilterIcon,
    UserIcon,
    Settings,
} from "lucide-react";

import PenguinIcon from "../../assets/icons/penguin.svg";

import { useUI, useData, useAuth } from "@/hooks";
import { useAuthStore } from "@/stores/authStore";
import { PoleshiftPermissions } from "@/types";
import { FileNodeWithChildren } from "@/hooks/useData.ts";
import { FileNodeType, ProximityCategory } from "@/lib/powersync/DrizzleSchema";

import CreateSampleGroupModal from "./Modals/CreateSampleGroupModal";
import CreateFolderModal from "./Modals/CreateFolderModal.tsx";
import CreateContainerModal from "./Modals/CreateContainerModal.tsx";
import { SettingsModal } from "./Modals/SettingsModal.tsx";
import { SyncProgressIndicator } from "./Indicators/SyncIndicator.tsx";
import { ResourceDownloadIndicator } from "./Indicators/ResourceDownloadIndicator.tsx";
import { NetworkIndicator } from "./Indicators/NetworkIndicator.tsx";

/* -------------------------------------------------------------------------
   1. Settings & Sync
------------------------------------------------------------------------- */
function SettingsAndSyncActions({
                                    onOpenFilters,
                                    onShowAccountActions,
                                    onOpenSettings,
                                    onCloseSettings,
                                    isSettingsOpen,
                                }: {
    onOpenFilters: () => void;
    onShowAccountActions: () => void;
    onOpenSettings: () => void;
    onCloseSettings: () => void;
    isSettingsOpen: boolean;
}) {
    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <button
                            onClick={onOpenFilters}
                            className="flex w-full items-center gap-2 px-2 py-1"
                        >
                            <FilterIcon className="h-4 w-4" />
                            <span>Filters</span>
                        </button>
                    </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <button
                            onClick={onShowAccountActions}
                            className="flex w-full items-center gap-2 px-2 py-1"
                        >
                            <UserIcon className="h-4 w-4" />
                            <span>Account</span>
                        </button>
                    </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <button
                            onClick={onOpenSettings}
                            className="flex w-full items-center gap-2 px-2 py-1"
                        >
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                        </button>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>

            {/* Modal kept outside the menu */}
            <SettingsModal isOpen={isSettingsOpen} onClose={onCloseSettings} />
        </>
    );
}

/* -------------------------------------------------------------------------
   2. Helpers for icons & labels
------------------------------------------------------------------------- */
function getNodeIcon(node: FileNodeWithChildren, expanded: boolean) {
    if (node.type === FileNodeType.Folder) {
        return expanded ? (
            <FolderOpenIcon className="h-4 w-4" />
        ) : (
            <FolderClosedIcon className="h-4 w-4" />
        );
    }
    if (node.type === FileNodeType.Container) {
        return <DatabaseIcon className="h-4 w-4" />;
    }
    if (node.type === FileNodeType.SampleGroup) {
        if (node.excluded) {
            return <Ban className="h-4 w-4 stroke-red-500" />;
        }
        if (node.penguin_present) {
            return <img src={PenguinIcon} alt="Penguin" className="h-4 w-4" />;
        }
        return <FlaskConical className="h-4 w-4 stroke-cyan-500" />;
    }
    return null;
}

function getProximityLabel(cat?: ProximityCategory | null) {
    switch (cat) {
        case ProximityCategory.Close:
            return "Close";
        case ProximityCategory.Far1:
            return "Far1";
        case ProximityCategory.Far2:
            return "Far2";
        default:
            return null;
    }
}

/* -------------------------------------------------------------------------
   3. Recursively render the file tree
------------------------------------------------------------------------- */
function renderTree(
    nodes: FileNodeWithChildren[],
    expandedIds: string[],
    onToggleExpand: (id: string) => void,
    selectedId: string | undefined,
    onSelect: (node: FileNodeWithChildren) => void
): React.ReactNode {
    return nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isActive = node.id === selectedId;
        const isExpanded = expandedIds.includes(node.id);
        const proximityLabel = getProximityLabel(node.proximity_category);

        if (hasChildren) {
            return (
                <SidebarMenuItem key={node.id}>
                    <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        onClick={() => {
                            onSelect(node);
                            onToggleExpand(node.id);
                        }}
                    >
                        <button className="flex w-full items-center gap-2 px-2 py-1">
                            {getNodeIcon(node, isExpanded)}
                            <span className="truncate">{node.name}</span>
                            {proximityLabel && (
                                <span className="ml-2 text-xs text-muted-foreground">
                  {proximityLabel}
                </span>
                            )}
                        </button>
                    </SidebarMenuButton>

                    {/* Conditionally render child subtree if expanded */}
                    {isExpanded && (
                        <SidebarMenuSub>
                            {node.children.map((child) => {
                                const childActive = child.id === selectedId;
                                const childHasKids = child.children && child.children.length > 0;
                                const childIsExpanded = expandedIds.includes(child.id);
                                const childProximity = getProximityLabel(
                                    child.proximity_category
                                );

                                if (childHasKids) {
                                    return (
                                        <SidebarMenuSubItem key={child.id}>
                                            <SidebarMenuSubButton
                                                asChild
                                                isActive={childActive}
                                                onClick={() => {
                                                    onSelect(child);
                                                    onToggleExpand(child.id);
                                                }}
                                            >
                                                <button className="flex w-full items-center gap-2 px-2 py-1">
                                                    {getNodeIcon(child, childIsExpanded)}
                                                    <span className="truncate">{child.name}</span>
                                                    {childProximity && (
                                                        <span className="ml-2 text-xs text-muted-foreground">
                              {childProximity}
                            </span>
                                                    )}
                                                </button>
                                            </SidebarMenuSubButton>
                                            {childIsExpanded && (
                                                <SidebarMenuSub>
                                                    {renderTree(
                                                        child.children,
                                                        expandedIds,
                                                        onToggleExpand,
                                                        selectedId,
                                                        onSelect
                                                    )}
                                                </SidebarMenuSub>
                                            )}
                                        </SidebarMenuSubItem>
                                    );
                                }

                                // Child is a leaf
                                return (
                                    <SidebarMenuSubItem key={child.id}>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={childActive}
                                            onClick={() => onSelect(child)}
                                        >
                                            <button className="flex items-center gap-2 px-2 py-1">
                                                {getNodeIcon(child, false)}
                                                <span className="truncate">{child.name}</span>
                                                {childProximity && (
                                                    <span className="ml-2 text-xs text-muted-foreground">
                            {childProximity}
                          </span>
                                                )}
                                            </button>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                );
                            })}
                        </SidebarMenuSub>
                    )}
                </SidebarMenuItem>
            );
        }

        // Leaf node
        return (
            <SidebarMenuItem key={node.id}>
                <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    onClick={() => onSelect(node)}
                >
                    <button className="flex w-full items-center gap-2 px-2 py-1">
                        {getNodeIcon(node, false)}
                        <span className="truncate">{node.name}</span>
                        {proximityLabel && (
                            <span className="ml-2 text-xs text-muted-foreground">
                {proximityLabel}
              </span>
                        )}
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    });
}

/* -------------------------------------------------------------------------
   4. "Application" actions for new folders, containers, etc.
------------------------------------------------------------------------- */
function ApplicationActions({
                                onNewSampleGroup,
                                onNewFolder,
                                onNewContainer,
                                onReset,
                                canCreate,
                            }: {
    onNewSampleGroup: () => void;
    onNewFolder: () => void;
    onNewContainer: () => void;
    onReset: () => void;
    canCreate: boolean;
}) {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={onNewSampleGroup} disabled={!canCreate}>
                    <PlusCircle className="mr-2 h-5 w-5" />
                    <span>New Sampling Event</span>
                </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
                <SidebarMenuButton onClick={onNewFolder} disabled={!canCreate}>
                    <FolderPlus className="mr-2 h-5 w-5" />
                    <span>New Folder</span>
                </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
                <SidebarMenuButton onClick={onNewContainer} disabled={!canCreate}>
                    <DatabaseIcon className="mr-2 h-5 w-5" />
                    <span>New Container</span>
                </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
                <SidebarMenuButton onClick={onReset}>
                    <Globe2 className="mr-2 h-5 w-5" />
                    <span>Reset Selection</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

interface LeftSidebarProps {
    openFilterMenu: () => void;
}

/* -------------------------------------------------------------------------
   5. The main LeftSidebar
------------------------------------------------------------------------- */
export function LeftSidebar({ openFilterMenu: handleOpenFilters }: LeftSidebarProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // UI & data hooks
    const {
        toggleLeftSidebar,
        isLeftSidebarCollapsed,
        setSelectedLeftItem,
        setErrorMessage,
        selectedLeftItem,
        setShowAccountActions,
    } = useUI();
    const { organization } = useAuth();
    const { fileTree, sampleGroups, locations, createSampleGroup, addFileNode } =
        useData();
    const { userPermissions } = useAuthStore.getState();

    // Permission check
    const hasCreatePermission = userPermissions?.includes(
        PoleshiftPermissions.CreateSampleGroup
    );

    // Local modals
    const [isSampleGroupModalOpen, setIsSampleGroupModalOpen] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);

    // Track expanded IDs for the tree
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    // Toggle folder expand/collapse
    const handleToggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) =>
            prev.includes(id) ? prev.filter((cur) => cur !== id) : [...prev, id]
        );
    }, []);

    // Modal open callbacks
    const openSampleGroupModal = useCallback(() => {
        if (!hasCreatePermission) {
            setErrorMessage("You do not have permission to create a new sampling event.");
            return;
        }
        setIsSampleGroupModalOpen(true);
    }, [hasCreatePermission, setErrorMessage]);

    const openFolderModal = useCallback(() => {
        if (!hasCreatePermission) {
            setErrorMessage("You do not have permission to create a new folder.");
            return;
        }
        setIsFolderModalOpen(true);
    }, [hasCreatePermission, setErrorMessage]);

    const openContainerModal = useCallback(() => {
        if (!hasCreatePermission) {
            setErrorMessage("You do not have permission to create a new container.");
            return;
        }
        setIsContainerModalOpen(true);
    }, [hasCreatePermission, setErrorMessage]);

    // Reset selection
    const handleResetSelection = useCallback(() => {
        setSelectedLeftItem(undefined);
        // If you want everything collapsed on reset:
        // setExpandedIds([]);
    }, [setSelectedLeftItem]);

    // Tree node selection
    const handleSelectNode = useCallback(
        (node: FileNodeWithChildren) => {
            setSelectedLeftItem(node);
        },
        [setSelectedLeftItem]
    );

    return (
        <div className="flex flex-col max-w-[345px] overflow-y-auto bg-background-primary">
            <SidebarProvider
                open={!isLeftSidebarCollapsed}
                onOpenChange={toggleLeftSidebar}
            >
                <Sidebar
                    side="left"
                    variant="sidebar"
                    collapsible="icon"
                    className={`transition-all duration-300 ${
                        isLeftSidebarCollapsed ? "w-16" : "w-[345px]"
                    }`}
                >
                    {/* Header with toggle button */}
                    <SidebarHeader>
                        <Button onClick={toggleLeftSidebar} variant="ghost" className="p-2">
                            <Menu className="h-4 w-4" />
                        </Button>
                    </SidebarHeader>

                    {/* Main content */}
                    <SidebarContent>
                        {/* 1) Settings & Sync */}
                        <SidebarGroup>
                            <SidebarGroupLabel>Settings</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SyncProgressIndicator collapsed={isLeftSidebarCollapsed} />
                                <NetworkIndicator />
                                <SettingsAndSyncActions
                                    onOpenFilters={handleOpenFilters}
                                    onShowAccountActions={() => setShowAccountActions(true)}
                                    onOpenSettings={() => setIsSettingsOpen(true)}
                                    onCloseSettings={() => setIsSettingsOpen(false)}
                                    isSettingsOpen={isSettingsOpen}
                                />
                            </SidebarGroupContent>
                        </SidebarGroup>

                        {/* 2) Create actions */}
                        <SidebarGroup>
                            <SidebarGroupLabel>Create</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <ApplicationActions
                                    onNewSampleGroup={openSampleGroupModal}
                                    onNewFolder={openFolderModal}
                                    onNewContainer={openContainerModal}
                                    onReset={handleResetSelection}
                                    canCreate={hasCreatePermission ?? false}
                                />
                            </SidebarGroupContent>
                        </SidebarGroup>

                        {/* 3) Samples tree */}
                        <SidebarGroup>
                            <SidebarGroupLabel>Samples</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {fileTree && fileTree.length > 0 ? (
                                        renderTree(
                                            fileTree,
                                            expandedIds,
                                            handleToggleExpand,
                                            selectedLeftItem?.id,
                                            handleSelectNode
                                        )
                                    ) : (
                                        <SidebarMenuItem>
                                            <SidebarMenuButton asChild>
                                                <Button variant="ghost">No items to display</Button>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>

                    {/* Optional download indicator & “rail” */}
                    <ResourceDownloadIndicator />
                    <SidebarRail />
                </Sidebar>
            </SidebarProvider>

            {/* Modals */}
            {isSampleGroupModalOpen && (
                <CreateSampleGroupModal
                    open={isSampleGroupModalOpen}
                    onClose={() => setIsSampleGroupModalOpen(false)}
                    organization={organization}
                    sampleGroups={sampleGroups}
                    locations={locations}
                    createSampleGroup={createSampleGroup}
                    setErrorMessage={setErrorMessage}
                />
            )}

            {isFolderModalOpen && (
                <CreateFolderModal
                    open={isFolderModalOpen}
                    onClose={() => setIsFolderModalOpen(false)}
                    organization={organization}
                    addFileNode={addFileNode}
                    setErrorMessage={setErrorMessage}
                />
            )}

            {isContainerModalOpen && (
                <CreateContainerModal
                    open={isContainerModalOpen}
                    onClose={() => setIsContainerModalOpen(false)}
                    organization={organization}
                    addFileNode={addFileNode}
                    setErrorMessage={setErrorMessage}
                />
            )}
        </div>
    );
}

export default LeftSidebar;
