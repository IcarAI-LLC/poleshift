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
    ChevronDown,
    // 1) Import both folder-open and folder-closed icons:
    Folder as FolderClosedIcon,
    FolderOpen as FolderOpenIcon,
    FilterIcon, UserIcon, Settings,
} from "lucide-react";

import PenguinIcon from "@/assets/icons/penguin.svg";

// Optional: for collapsible groups
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";

import {useUI, useData, useAuth, useNetworkStatus} from "@/lib/hooks";
import { useAuthStore } from "@/lib/stores/authStore";
import { PoleshiftPermissions } from "@/lib/types";
import { FileNodeWithChildren } from "@/lib/hooks/useData";
import { FileNodeType, ProximityCategory } from "@/lib/powersync/DrizzleSchema";

import CreateSampleGroupModal from "./CreateSampleGroupModal";
import CreateFolderModal from "./CreateFolderModal";
import CreateContainerModal from "./CreateContainerModal";
import {SettingsModal} from "@/components/TopControls/SettingsModal.tsx";
import {SyncProgressIndicator} from "@/components/LeftSidebar/SyncIndicator.tsx";
import {ResourceDownloadIndicator} from "@/components/LeftSidebar/ResourceDownloadIndicator.tsx";

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
    isSyncing: boolean;
}) {
    return (
        <>
            {/* Wrap them in a SidebarMenu just like "CreateSample" actions */}
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <button
                            onClick={onOpenFilters}
                            className="flex w-full items-center gap-2 px-2 py-1"
                        >
                            <FilterIcon className="h-4 w-4" />
                            <span>Filters</span>

                            {/* Or use your existing FilterButton, which might contain its own icon */}
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

            {/* Keep the modal outside the menu */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={onCloseSettings}
            />
        </>
    );
}

/* --------------------------------------------------------------------------------
   1. Helpers for icons & labels
----------------------------------------------------------------------------------*/
function getNodeIcon(node: FileNodeWithChildren, expanded: boolean) {
    if (node.type === FileNodeType.Folder) {
        // Show FolderOpen if expanded, FolderClosed otherwise:
        return expanded ? <FolderOpenIcon className="h-4 w-4" /> : <FolderClosedIcon className="h-4 w-4" />;
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

/* --------------------------------------------------------------------------------
   2. Recursively render the file tree
----------------------------------------------------------------------------------*/
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
                    {/*
                      On click, we both toggle expand and select the node.
                      If you'd prefer separate “arrow vs label” clicks,
                      split them into two clickable elements.
                    */}
                    <SidebarMenuButton asChild isActive={isActive}>
                        <button
                            className="flex w-full items-center gap-2 px-2 py-1"
                            onClick={() => {
                                onSelect(node);
                                onToggleExpand(node.id);
                            }}
                        >
                            {getNodeIcon(node, isExpanded)}
                            <span className="truncate">{node.name}</span>
                            {proximityLabel && (
                                <span className="ml-2 text-xs text-muted-foreground">{proximityLabel}</span>
                            )}
                        </button>
                    </SidebarMenuButton>

                    {/* Conditionally render the child subtree if expanded */}
                    {isExpanded && (
                        <SidebarMenuSub>
                            {node.children.map((child) => {
                                const childActive = child.id === selectedId;
                                const childProximity = getProximityLabel(child.proximity_category);
                                const childHasKids = child.children && child.children.length > 0;
                                const childIsExpanded = expandedIds.includes(child.id);

                                if (childHasKids) {
                                    return (
                                        <SidebarMenuSubItem key={child.id}>
                                            <SidebarMenuSubButton asChild isActive={childActive}>
                                                <button
                                                    className="flex w-full items-center gap-2 px-2 py-1"
                                                    onClick={() => {
                                                        onSelect(child);
                                                        onToggleExpand(child.id);
                                                    }}
                                                >
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
                                                    {/* Recursively render grandchildren, etc. */}
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
                <SidebarMenuButton asChild isActive={isActive} onClick={() => onSelect(node)}>
                    <button className="flex w-full items-center gap-2 px-2 py-1">
                        {getNodeIcon(node, false)}
                        <span className="truncate">{node.name}</span>
                        {proximityLabel && (
                            <span className="ml-2 text-xs text-muted-foreground">{proximityLabel}</span>
                        )}
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    });
}

/* --------------------------------------------------------------------------------
   3. A small component for your "Application" actions
----------------------------------------------------------------------------------*/
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
/* --------------------------------------------------------------------------------
   4. The main LeftSidebar
----------------------------------------------------------------------------------*/
export function LeftSidebar({openFilterMenu: handleOpenFilters}: LeftSidebarProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Hooks
    const {
        toggleLeftSidebar,
        isLeftSidebarCollapsed,
        setSelectedLeftItem,
        setErrorMessage,
        selectedLeftItem,
        setShowAccountActions,
    } = useUI();

    const { isSyncing } = useNetworkStatus();
    const { organization } = useAuth();
    const { fileTree, sampleGroups, locations, createSampleGroup, addFileNode } = useData();
    const { userPermissions } = useAuthStore.getState();

    // Permission check
    const hasCreatePermission = userPermissions?.includes(PoleshiftPermissions.CreateSampleGroup);

    // Local modals
    const [isSampleGroupModalOpen, setIsSampleGroupModalOpen] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);

    // Track which folders are expanded
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    // Toggle expand/collapse for a folder
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
        // optional: clear expansions if you want everything collapsed
        // setExpandedIds([]);
    }, [setSelectedLeftItem]);

    // Handle tree node selection
    const handleSelectNode = useCallback(
        (node: FileNodeWithChildren) => {
            setSelectedLeftItem(node);
        },
        [setSelectedLeftItem]
    );

    return (
        <div className={ "flex flex-col max-w-1 overflow-y-auto bg-background-primary"}>
            <SidebarProvider open={!isLeftSidebarCollapsed} onOpenChange={toggleLeftSidebar}>
                <Sidebar
                    side="left"
                    variant="sidebar"
                    collapsible={"icon"}
                    className={`transition-all duration-300 ${
                        isLeftSidebarCollapsed ? "w-16" : "w-[345px]"
                    }`}
                >
                    <SidebarHeader className="justify-left p-2 flex-row">
                        <Button onClick={toggleLeftSidebar} variant="ghost" className="p-2">
                            <Menu className="h-4 w-4" />
                        </Button>
                    </SidebarHeader>

                    <SidebarContent>
                        {/* "App Manage */}
                        <Collapsible defaultOpen className="group/collapsible">
                            <SidebarGroup>
                                <SidebarGroupLabel asChild>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-sm font-medium">
                                        Settings
                                        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>

                                <CollapsibleContent>
                                    <SidebarGroupContent>
                                        {/* Now use the new SettingsAndSyncActions */}
                                        <SyncProgressIndicator collapsed={isLeftSidebarCollapsed}/>
                                        <SettingsAndSyncActions
                                            onOpenFilters={handleOpenFilters}
                                            onShowAccountActions={() => setShowAccountActions(true)}
                                            onOpenSettings={() => setIsSettingsOpen(true)}
                                            onCloseSettings={() => setIsSettingsOpen(false)}
                                            isSettingsOpen={isSettingsOpen}
                                            isSyncing={isSyncing}
                                        />
                                    </SidebarGroupContent>
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>

                        {/* "Create and Manage" group (Collapsible) */}
                        <Collapsible defaultOpen className="group/collapsible">
                            <SidebarGroup>
                                <SidebarGroupLabel asChild>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-sm font-medium">
                                        Create
                                        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>

                                <CollapsibleContent>
                                    <SidebarGroupContent>
                                        <ApplicationActions
                                            onNewSampleGroup={openSampleGroupModal}
                                            onNewFolder={openFolderModal}
                                            onNewContainer={openContainerModal}
                                            onReset={handleResetSelection}
                                            canCreate={hasCreatePermission ?? false}
                                        />
                                    </SidebarGroupContent>
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>

                        {/* "Samples" group (Collapsible) */}
                        <Collapsible defaultOpen className="group/collapsible">
                            <SidebarGroup>
                                <SidebarGroupLabel asChild>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-sm font-medium">
                                        <span>Samples</span>
                                        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>
                                <CollapsibleContent>
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
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>
                    </SidebarContent>
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
