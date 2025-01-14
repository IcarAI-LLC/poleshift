// components/LeftSidebar/SidebarTree.tsx

import {
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarMenuAction,
} from "@/components/ui/sidebar";

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import { MoreHorizontal } from "lucide-react"; // or your icon of choice

import { getNodeIcon, getProximityLabel } from "./SidebarHelpers";
import { FileNodeWithChildren } from "@/hooks/useData";
import {useAuthStore} from "@/stores/authStore.ts";
import {PoleshiftPermissions} from "@/types";

interface SidebarTreeProps {
    fileTree: FileNodeWithChildren[];
    expandedIds: string[];
    selectedId?: string;
    onToggleExpand: (id: string) => void;
    onSelect: (node: FileNodeWithChildren) => void;
    /**
     * You might have handlers for "move" and "delete" here:
     */
    onMove: (node: FileNodeWithChildren) => void;
    onDelete: (node: FileNodeWithChildren) => void;
    /**
     * If you have a permissions object or function, you can pass it in or
     * handle logic inside the node. This example uses booleans for each node.
     */
}

export function SidebarTree({
                                fileTree,
                                expandedIds,
                                selectedId,
                                onToggleExpand,
                                onSelect,
                                onMove,
                                onDelete,
                            }: SidebarTreeProps) {
    const { userPermissions } = useAuthStore.getState()
    const canDelete =
        userPermissions?.includes(PoleshiftPermissions.DeleteSampleGroup) ?? false
    const canMove =
        userPermissions?.includes(PoleshiftPermissions.ModifySampleGroup) ?? false

    if (!fileTree || fileTree.length === 0) {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <button className="flex items-center px-2 py-1" disabled>
                        No items to display
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    return (
        <>
            {fileTree.map((node) => {
                const hasChildren = node.children && node.children.length > 0;
                const isActive = node.id === selectedId;
                const isExpanded = expandedIds.includes(node.id);
                const proximityLabel = getProximityLabel(node.proximity_category);

                /**
                 * To keep the code DRY, here's a small sub-component
                 * that renders the "More" dropdown if the user has permissions.
                 */
                const renderActions = () => {
                    // If no permissions, you can return null or nothing:
                    if (!canMove && !canDelete) {
                        return null;
                    }

                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuAction>
                                    <MoreHorizontal className="h-4 w-4" />
                                </SidebarMenuAction>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent side="right" align="start">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {canMove && (
                                    <DropdownMenuItem onClick={() => onMove(node)}>
                                        Move
                                    </DropdownMenuItem>
                                )}
                                {canDelete && (
                                    <DropdownMenuItem
                                        onClick={() => onDelete(node)}
                                        className="text-destructive"
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                };

                if (hasChildren) {
                    // Node with children (Folder)
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
                                <button className="items-center gap-2 px-2 py-1 w-full text-left">
                                    {getNodeIcon(node, isExpanded)}
                                    <span className="truncate">{node.name}</span>
                                    {proximityLabel && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                      {proximityLabel}
                    </span>
                                    )}
                                </button>
                            </SidebarMenuButton>

                            {/* Here is your “More” action dropdown. */}
                            {renderActions()}

                            {isExpanded && (
                                <SidebarMenuSub>
                                    {node.children.map((child) => {
                                        const childActive = child.id === selectedId;
                                        const childHasKids =
                                            child.children && child.children.length > 0;
                                        const childIsExpanded = expandedIds.includes(child.id);
                                        const childProximity = getProximityLabel(
                                            child.proximity_category
                                        );

                                        // Same permission logic for the child:
                                        const childCanMove = canMove;
                                        const childCanDelete = canDelete;

                                        const renderChildActions = () => {
                                            if (!childCanMove && !childCanDelete) return null;
                                            return (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <SidebarMenuAction>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </SidebarMenuAction>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent side="right" align="start">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        {childCanMove && (
                                                            <DropdownMenuItem onClick={() => onMove(child)}>
                                                                Move
                                                            </DropdownMenuItem>
                                                        )}
                                                        {childCanDelete && (
                                                            <DropdownMenuItem
                                                                onClick={() => onDelete(child)}
                                                                className="text-destructive"
                                                            >
                                                                Delete
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            );
                                        };

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
                                                        <button className="items-center gap-2 px-2 py-1 w-full text-left">
                                                            {getNodeIcon(child, childIsExpanded)}
                                                            <span className="truncate">{child.name}</span>
                                                            {childProximity && (
                                                                <span className="ml-2 text-xs text-muted-foreground">
                                  {childProximity}
                                </span>
                                                            )}
                                                        </button>
                                                    </SidebarMenuSubButton>

                                                    {/* Child “More” action */}
                                                    {renderChildActions()}

                                                    {childIsExpanded && (
                                                        <SidebarMenuSub>
                                                            <SidebarTree
                                                                fileTree={child.children || []}
                                                                expandedIds={expandedIds}
                                                                selectedId={selectedId}
                                                                onToggleExpand={onToggleExpand}
                                                                onSelect={onSelect}
                                                                onMove={onMove}
                                                                onDelete={onDelete}
                                                            />
                                                        </SidebarMenuSub>
                                                    )}
                                                </SidebarMenuSubItem>
                                            );
                                        }

                                        // Leaf child
                                        return (
                                            <SidebarMenuSubItem key={child.id}>
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={childActive}
                                                    onClick={() => onSelect(child)}
                                                >
                                                    <button className="flex items-center gap-2 px-2 py-1 w-full text-left">
                                                        {getNodeIcon(child, false)}
                                                        <span className="truncate">{child.name}</span>
                                                        {childProximity && (
                                                            <span className="ml-2 text-xs text-muted-foreground">
                                {childProximity}
                              </span>
                                                        )}
                                                    </button>
                                                </SidebarMenuSubButton>

                                                {/* Child “More” action */}
                                                {renderChildActions()}
                                            </SidebarMenuSubItem>
                                        );
                                    })}
                                </SidebarMenuSub>
                            )}
                        </SidebarMenuItem>
                    );
                } else {
                    // Leaf node (File)
                    return (
                        <SidebarMenuItem key={node.id}>
                            <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                onClick={() => onSelect(node)}
                            >
                                <button className="flex items-center gap-2 px-2 py-1 w-full text-left">
                                    {getNodeIcon(node, false)}
                                    <span className="truncate">{node.name}</span>
                                    {proximityLabel && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                      {proximityLabel}
                    </span>
                                    )}
                                </button>
                            </SidebarMenuButton>

                            {/* Leaf “More” action */}
                            {renderActions()}
                        </SidebarMenuItem>
                    );
                }
            })}
        </>
    );
}
