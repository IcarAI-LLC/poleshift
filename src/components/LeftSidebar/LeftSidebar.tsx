// components/LeftSidebar/LeftSidebar.tsx
import { SetStateAction, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

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
  // etc.
} from '@/components/ui/sidebar';

import { useUI, useData, useAuth } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { PoleshiftPermissions } from '@/types';

// Our new smaller components
import { SettingsAndSyncActions } from './SettingsAndSyncActions';
import { ApplicationActions } from './ApplicationActions';
import { SidebarTree } from './SidebarTree';

// Indicators
import { SyncProgressIndicator } from './Indicators/SyncIndicator';
import { ResourceDownloadIndicator } from './Indicators/ResourceDownloadIndicator';
import { NetworkIndicator } from './Indicators/NetworkIndicator';

// Modals
import CreateSampleGroupModal from './Modals/CreateSampleGroupModal';
import CreateFolderModal from './Modals/CreateFolderModal';
import CreateContainerModal from './Modals/CreateContainerModal';
import { FilterModal } from './Modals/FilterModal';
import MoveModal from './Modals/MoveModal';

export function LeftSidebar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

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
  const {
    fileTree,
    sampleGroups,
    locations,
    createSampleGroup,
    addFileNode,
    deleteNode,
  } = useData();
  const userPermissions = useAuthStore((state) => state.userPermissions);
  const canDeleteSampleGroup =
    userPermissions?.includes(PoleshiftPermissions.DeleteSampleGroup) ?? false;
  const canModifySampleGroup =
    userPermissions?.includes(PoleshiftPermissions.ModifySampleGroup) ?? false;
  const hasCreatePermission = userPermissions?.includes(
    PoleshiftPermissions.CreateSampleGroup
  );

  // (A) Local modals for creation
  const [isSampleGroupModalOpen, setIsSampleGroupModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);

  // (B) State for “move” action
  const [moveModalItemId, setMoveModalItemId] = useState<string | null>(null);

  // (C) Tree expand/collapse
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((cur) => cur !== id) : [...prev, id]
    );
  }, []);

  // (D) Tree selection
  const handleSelectNode = useCallback(
    (
      node:
        | {
            id: string;
            name: string;
            created_at: string;
            org_id: string;
            updated_at: string;
            parent_id: string | null;
            type: string;
            version: number;
            sample_group_id: string | null;
            droppable: number;
          }
        | undefined
    ) => {
      setSelectedLeftItem(node);
    },
    [setSelectedLeftItem]
  );

  // (E) Actions from the tree: move/delete
  const handleMove = useCallback(
    (node: { id: SetStateAction<string | null> }) => {
      if (!canModifySampleGroup) {
        setErrorMessage(
          'You do not have permission to modify this sample group.'
        );
        return;
      }
      setMoveModalItemId(node.id);
    },
    [canModifySampleGroup, setErrorMessage]
  );

  const handleDelete = useCallback(
    async (node: { id: string | undefined }) => {
      if (!canDeleteSampleGroup || !node.id) {
        setErrorMessage(
          'You do not have permission to delete this sample group.'
        );
        return;
      }
      try {
        // Optionally show a "ConfirmDeleteModal" first. For brevity, we do direct:
        await deleteNode(node.id);
        // If user deleted the currently selected item, reset selection
        if (selectedLeftItem?.id === node.id) {
          setSelectedLeftItem(undefined);
        }
      } catch (err) {
        setErrorMessage(String(err));
      }
    },
    [
      canDeleteSampleGroup,
      deleteNode,
      selectedLeftItem,
      setSelectedLeftItem,
      setErrorMessage,
    ]
  );

  // Filter callbacks
  const handleApplyFilters = useCallback(() => {
    setIsFilterMenuOpen(false);
  }, []);
  const handleResetFilters = useCallback(() => {
    setIsFilterMenuOpen(false);
  }, []);

  // Create callbacks
  const openSampleGroupModal = useCallback(() => {
    if (!hasCreatePermission) {
      setErrorMessage(
        'You do not have permission to create a new sampling event.'
      );
      return;
    }
    setIsSampleGroupModalOpen(true);
  }, [hasCreatePermission, setErrorMessage]);

  const openFolderModal = useCallback(() => {
    if (!hasCreatePermission) {
      setErrorMessage('You do not have permission to create a new folder.');
      return;
    }
    setIsFolderModalOpen(true);
  }, [hasCreatePermission, setErrorMessage]);

  const openContainerModal = useCallback(() => {
    if (!hasCreatePermission) {
      setErrorMessage('You do not have permission to create a new container.');
      return;
    }
    setIsContainerModalOpen(true);
  }, [hasCreatePermission, setErrorMessage]);

  // Reset selection
  const handleResetSelection = useCallback(() => {
    setSelectedLeftItem(undefined);
    // Optionally collapse all
    // setExpandedIds([]);
  }, [setSelectedLeftItem]);

  return (
    <SidebarProvider
      open={!isLeftSidebarCollapsed}
      onOpenChange={toggleLeftSidebar}
      style={{
        //@ts-expect-error custom CSS var
        '--sidebar-width': '24rem',
        '--sidebar-width-mobile': '24rem',
      }}
    >
      <Sidebar side='left' variant='floating' collapsible='icon'>
        <SidebarHeader className='place-content-start'>
          <Button
            onClick={toggleLeftSidebar}
            variant='ghost'
            className='pr-4 pl-2 flex-start justify-start'
          >
            <Menu className='h-4 w-4' />
            {!isLeftSidebarCollapsed && <span>Poleshift</span>}
          </Button>
        </SidebarHeader>

        <SidebarContent>
          {/* 1) Settings & Sync */}
          <SidebarGroup>
            <SidebarGroupLabel>Meta</SidebarGroupLabel>
            <SidebarGroupContent>
              <SyncProgressIndicator collapsed={isLeftSidebarCollapsed} />
              <NetworkIndicator showText={!isLeftSidebarCollapsed} />
              <SettingsAndSyncActions
                onOpenFilters={() => setIsFilterMenuOpen(true)}
                onShowAccountActions={() => setShowAccountActions(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onCloseSettings={() => setIsSettingsOpen(false)}
                isSettingsOpen={isSettingsOpen}
              />
            </SidebarGroupContent>
          </SidebarGroup>

          {/* 2) Create actions */}
          <SidebarGroup>
            <SidebarGroupLabel>Actions</SidebarGroupLabel>
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
                {!fileTree?.length && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Button variant='ghost'>No items to display</Button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {fileTree?.length > 0 && (
                  <SidebarTree
                    fileTree={fileTree}
                    expandedIds={expandedIds}
                    selectedId={selectedLeftItem?.id}
                    onToggleExpand={handleToggleExpand}
                    onSelect={handleSelectNode}
                    // Pass the new callbacks here
                    onMove={handleMove}
                    onDelete={handleDelete}
                  />
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <ResourceDownloadIndicator />
        <SidebarRail />
      </Sidebar>

      {/* (A) Create modals */}
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

      {/* (B) Move modal */}
      {moveModalItemId && (
        <MoveModal
          itemId={moveModalItemId}
          onClose={() => setMoveModalItemId(null)}
        />
      )}

      {/* (C) Filter Modal */}
      {isFilterMenuOpen && (
        <FilterModal
          open={isFilterMenuOpen}
          onOpenChange={(isOpen) => setIsFilterMenuOpen(isOpen)}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      )}
    </SidebarProvider>
  );
}

export default LeftSidebar;
