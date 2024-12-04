// src/components/LeftSidebar.tsx

import React, { useCallback, useState, useMemo } from 'react';
import { Box, Button, IconButton, SelectChangeEvent, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import {
  Sync as SyncIcon,
  Menu as MenuIcon,
  AddCircle as AddCircleIcon,
  CreateNewFolder as CreateNewFolderIcon,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { useUI } from '../../lib/hooks';
import { useData } from '../../lib/hooks';
import { useAuth } from '../../lib/hooks';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleLocation } from '../../lib/types';
import { DateTime } from 'luxon';

import Modal from '../Modal';
import AccountButton from './AccountButton';
import LeftSidebarTree from './LeftSidebarTree';

interface ModalState {
  isOpen: boolean;
  title: string;
  configItem: DropboxConfigItem | null;
  modalInputs: Record<string, string>;
  uploadedFiles: File[];
  isProcessing: boolean;
}

interface LeftSidebarProps {
  userTier: string;
}

const LeftSidebar: React.FC<LeftSidebarProps> = () => {
  const theme = useTheme();
  const { sampleGroups, updateFileTree, fileTree, createSampleGroup } = useData();
  const { isSyncing, locations } = useData();
  const { organization, user } = useAuth();
  const {
    isLeftSidebarCollapsed,
    toggleLeftSidebar,
    setErrorMessage,
    setShowAccountActions,
  } = useUI();
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    configItem: null,
    modalInputs: {},
    uploadedFiles: [],
    isProcessing: false,
  });
  const styles = useMemo(
      () => ({
        sidebarButton: {
          width: '100%',
          justifyContent: 'flex-start',
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        } as const,
        toggleButton: {
          position: 'fixed',
          top: 'var(--spacing-sm)',
          left: 'var(--spacing-sm)',
          color: 'var(--color-text)',
          zIndex: 1001,
          padding: '8px',
          '&:hover': {
            color: 'var(--color-primary)',
            backgroundColor: 'transparent',
          },
        } as SxProps<Theme>,
        syncIcon: {
          position: 'fixed',
          top: 'var(--spacing-sm)',
          left: '50px',
          padding: '8px',
          zIndex: 1001,
        } as SxProps<Theme>,
        sidebar: {
          width: 'var(--sidebar-width)',
          height: '100vh',
          backgroundColor: 'var(--color-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.standard,
          }),
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1000,
        } as const,
        contentContainer: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginTop: 'var(--header-height)',
        } as const,
        buttonContainer: {
          padding: theme.spacing(2),
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing(1),
          borderBottom: '1px solid var(--color-border)',
        } as const,
      }),
      [theme]
  );

  // Define individual modal action handlers
  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      title: '',
      configItem: null,
      modalInputs: {},
      uploadedFiles: [],
      isProcessing: false,
    });
  }, []);

  const openModal = useCallback(
      (
          title: string,
          configItem: DropboxConfigItem,
          uploadedFiles: File[] = []
      ) => {
        if (configItem.modalFields?.length) {
          setModalState({
            isOpen: true,
            title,
            configItem,
            modalInputs: {},
            uploadedFiles,
            isProcessing: false,
          });
        }
      },
      []
  );

  const handleModalChange = useCallback(
      (
          e:
              | React.ChangeEvent<HTMLTextAreaElement>
              | React.ChangeEvent<{ name?: string; value: unknown }>
              | SelectChangeEvent
      ) => {
        const { name, value } = e.target;

        if (typeof name === 'string') {
          const stringValue = typeof value === 'string' ? value : String(value);
          setModalState((prev) => ({
            ...prev,
            modalInputs: { ...prev.modalInputs, [name]: stringValue },
          }));
        } else {
          console.warn('Input element is missing a name attribute.');
        }
      },
      []
  );

  const handleModalSubmit = useCallback(
      async (e?: React.FormEvent<HTMLFormElement>) => {
        if (e) e.preventDefault();
        const { configItem, modalInputs } = modalState;

        if (!configItem || !organization?.id || !organization.org_short_id || !user?.id)
          return;

        setModalState((prev) => ({ ...prev, isProcessing: true }));

        try {
          if (configItem.processFunctionName === 'sampleGroup') {
            const { collectionDate, collectionTime, locCharId } = modalInputs;

            // Input validation
            if (!collectionDate || !locCharId) {
              throw new Error(
                  'Collection date and location are required to create a sample group.'
              );
            }

            // Format the date as YYYY-MM-DD
            const formattedDate = new Date(collectionDate).toISOString().split('T')[0];
            const baseName = `${formattedDate}-${locCharId}`;

            // Check existing groups from local sampleGroups data
            const existingNumbers = Object.values(sampleGroups)
                .filter((group) => group.org_id === organization.id)
                .map((group) => {
                  const regex = new RegExp(
                      `^${baseName}-(\\d{2})-${organization.org_short_id}$`
                  );
                  const match = group.human_readable_sample_id.match(regex);
                  return match ? parseInt(match[1], 10) : null;
                })
                .filter((num): num is number => num !== null);

            // Determine next available number
            let nextNumber = 0;
            while (existingNumbers.includes(nextNumber)) {
              nextNumber += 1;
            }
            const formattedNumber = String(nextNumber).padStart(2, '0');

            // Construct sample group name
            const sampleGroupName = `${baseName}-${formattedNumber}-${organization.org_short_id}`;

            // Find location
            const location = locations.find((loc) => loc.char_id === locCharId);
            if (!location) {
              throw new Error(`Location with char_id ${locCharId} not found.`);
            }

            // Create storage folder path
            const rawDataFolderPath = `${organization.org_short_id}/${sampleGroupName}/`;

            // Generate a unique ID
            const id: string = uuidv4();

            // Create new sample group node
            const newNode = {
              id,
              org_id: organization.id,
              name: sampleGroupName,
              type: 'sampleGroup',
              parent_id: null,
              droppable: false,
              children: [],
              version: 1,
              sample_group_id: id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // Prepare sample group data
            const sampleGroupData = {
              id,
              human_readable_sample_id: sampleGroupName,
              loc_id: location.id,
              storage_folder: rawDataFolderPath,
              collection_date: formattedDate,
              collection_datetime_utc: collectionTime
                  ? `${collectionDate}T${collectionTime}Z`
                  : undefined,
              user_id: user.id,
              org_id: organization.id,
              latitude_recorded: undefined,
              longitude_recorded: undefined,
              notes: undefined,
              created_at: new Date().toISOString(),
              updated_at: DateTime.now().toISO(),
            };

            // Use createSampleGroup from useData
            await createSampleGroup(sampleGroupData, newNode);

            setErrorMessage('');
          } else if (configItem.processFunctionName === 'folder') {
            // Handle folder creation as per your application's logic
            // Create new folder node
            const newFolder = {
              id: uuidv4(),
              org_id: organization.id,
              name: modalInputs.name,
              type: 'folder',
              parent_id: null,
              droppable: true,
              children: [],
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // Update file tree with new folder
            const updatedTree = [...fileTree, newFolder];
            await updateFileTree(updatedTree);
            setErrorMessage('');
          }
        } catch (error: any) {
          console.error('Error creating item:', error);
          setErrorMessage(error.message || 'An unexpected error occurred.');
        } finally {
          closeModal();
        }
      },
      [
        modalState,
        organization,
        user,
        locations,
        sampleGroups,
        createSampleGroup,
        setErrorMessage,
        closeModal,
        fileTree,
        updateFileTree,
      ]
  );

  // Assemble modal action handlers
  const handleModalActions = {
    open: openModal,
    close: closeModal,
    change: handleModalChange,
    submit: handleModalSubmit,
  };

  const createActions = {
    sampleGroup: useCallback(() => {
      const configItem: DropboxConfigItem = {
        id: 'create-sampleGroup',
        dataType: '',
        expectedFileTypes: null,
        isEnabled: false,
        isModalInput: false,
        label: '',
        modalFields: [
          {
            name: 'collectionDate',
            label: 'Collection Date',
            type: 'date',
            tooltip: 'Select the date when the sample was collected.',
            required: true,
          },
          {
            name: 'collectionTime',
            label: 'Collection Time',
            type: 'time',
            tooltip:
                'Optionally specify the time when the sample was collected. Leave blank if unknown.',
            required: false,
          },
          {
            name: 'locCharId',
            label: 'Location',
            type: 'select',
            options: locations.map((loc: SampleLocation) => ({
              value: loc.char_id,
              label: loc.label,
            })),
            tooltip: 'Select the location where the sample was collected.',
            required: true,
          },
        ],
        processFunctionName: 'sampleGroup',
      };

      handleModalActions.open('Create New Sampling Event', configItem);
    }, [locations, handleModalActions]),

    folder: useCallback(() => {
      const configItem: DropboxConfigItem = {
        id: 'create-folder',
        dataType: '',
        expectedFileTypes: null,
        isEnabled: false,
        isModalInput: false,
        label: '',
        modalFields: [{ name: 'name', label: 'Folder Name', type: 'text' }],
        processFunctionName: 'folder',
      };

      handleModalActions.open('Create New Folder', configItem);
    }, [handleModalActions]),
  };

  const handleToggleLeftSidebar = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        toggleLeftSidebar();
      },
      [toggleLeftSidebar]
  );

  return (
      <>
        <Box className="sidebar-controls">
          <IconButton
              onClick={handleToggleLeftSidebar}
              aria-label="Toggle Sidebar"
              sx={styles.toggleButton}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={styles.syncIcon}>
            <Tooltip title={isSyncing ? 'Syncing data...' : 'All changes saved'}>
            <span>
              <SyncIcon
                  className={isSyncing ? 'syncing' : ''}
                  sx={{
                    fontSize: 24,
                    fill: isSyncing ? '#f44336' : '#4caf50',
                  }}
              />
            </span>
            </Tooltip>
          </Box>

          <AccountButton setShowAccountActions={setShowAccountActions} />
        </Box>

        <Box
            className={`left-sidebar ${isLeftSidebarCollapsed ? 'collapsed' : ''}`}
            sx={styles.sidebar}
        >
          <Box sx={styles.contentContainer}>
            <Box sx={styles.buttonContainer}>
              <Button
                  variant="contained"
                  onClick={createActions.sampleGroup}
                  aria-label="Create New Sampling Event"
                  sx={styles.sidebarButton}
                  disableElevation
              >
                <AddCircleIcon />
                {!isLeftSidebarCollapsed && (
                    <span style={{ marginLeft: theme.spacing(1) }}>
                  New Sampling Event
                </span>
                )}
              </Button>
              <Button
                  variant="contained"
                  onClick={createActions.folder}
                  aria-label="Create New Folder"
                  sx={styles.sidebarButton}
                  disableElevation
              >
                <CreateNewFolderIcon />
                {!isLeftSidebarCollapsed && (
                    <span style={{ marginLeft: theme.spacing(1) }}>New Folder</span>
                )}
              </Button>
            </Box>

            <LeftSidebarTree />
          </Box>
        </Box>

        {modalState.isOpen && modalState.configItem && (
            <Modal
                isOpen={modalState.isOpen}
                title={modalState.title}
                onClose={handleModalActions.close}
                modalFields={modalState.configItem.modalFields}
                modalInputs={modalState.modalInputs}
                handleModalChange={handleModalActions.change}
                handleModalSubmit={handleModalActions.submit}
                isProcessing={modalState.isProcessing}
            />
        )}
      </>
  );
};

export default LeftSidebar;
