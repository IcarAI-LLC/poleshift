// components/LeftSidebar/SettingsAndSyncActions.tsx
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { FilterIcon, UserIcon, Settings } from 'lucide-react';
import { SettingsModal } from '@/components/LeftSidebar/Modals/SettingsModal';
import { ModeToggle } from '@/components/LeftSidebar/Toggles/ModeToggle';

interface SettingsAndSyncActionsProps {
  onOpenFilters: () => void;
  onShowAccountActions: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  isSettingsOpen: boolean;
}

export function SettingsAndSyncActions({
  onOpenFilters,
  onShowAccountActions,
  onOpenSettings,
  onCloseSettings,
  isSettingsOpen,
}: SettingsAndSyncActionsProps) {
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <button
              onClick={onOpenFilters}
              className='flex items-center gap-2 px-2 py-1'
            >
              <FilterIcon className='h-4 w-4' />
              <span>Filters</span>
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <button
              onClick={onShowAccountActions}
              className='flex items-center gap-2 px-2 py-1'
            >
              <UserIcon className='h-4 w-4' />
              <span>Account</span>
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <button
              onClick={onOpenSettings}
              className='flex items-center gap-2 px-2 py-1'
            >
              <Settings className='h-4 w-4' />
              <span>Settings</span>
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* The theme toggle can be placed in its own SidebarMenu or by itself. */}
      <SidebarMenu className='mt-2'>
        <SidebarMenuItem>
          <ModeToggle />
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={onCloseSettings} />
    </>
  );
}
