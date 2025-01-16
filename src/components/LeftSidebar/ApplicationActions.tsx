// components/LeftSidebar/ApplicationActions.tsx
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
    PlusCircle,
    FolderPlus,
    DatabaseIcon,
    Globe2,
} from "lucide-react";

interface ApplicationActionsProps {
    onNewSampleGroup: () => void;
    onNewFolder: () => void;
    onNewContainer: () => void;
    onReset: () => void;
    canCreate: boolean;
}

export function ApplicationActions({
                                       onNewSampleGroup,
                                       onNewFolder,
                                       onNewContainer,
                                       onReset,
                                       canCreate,
                                   }: ApplicationActionsProps) {
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
                    <span>Return to Globe</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
