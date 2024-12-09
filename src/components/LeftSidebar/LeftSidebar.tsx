// src/components/LeftSidebar.tsx

import React, { useCallback, useState, useMemo } from 'react';
import {Box, Button, SelectChangeEvent} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AddCircle as AddCircleIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { useUI } from '../../lib/hooks';
import { useData } from '../../lib/hooks';
import { useAuth } from '../../lib/hooks';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleLocation } from '../../lib/types';
import { DateTime } from 'luxon';

import Modal from '../Modal';
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
  const { locations } = useData();
  const { organization, user } = useAuth();
  const {
    isLeftSidebarCollapsed,
    setErrorMessage,
    setSelectedLeftItem,
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
        sidebarButton: {
          width: '100%',
          justifyContent: 'flex-start',
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        } as const,
        resetButton: {
          width: '100%',
          justifyContent: 'flex-start',
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        } as const,
      }),
      [theme]
  );

  // Modal handlers
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
      (title: string, configItem: DropboxConfigItem, uploadedFiles: File[] = []) => {
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
          e: React.ChangeEvent<HTMLTextAreaElement> |
              React.ChangeEvent<{ name?: string; value: unknown }> |
              SelectChangeEvent
      ) => {
        const { name, value } = e.target;
        if (typeof name === 'string') {
          const stringValue = typeof value === 'string' ? value : String(value);
          setModalState((prev) => ({
            ...prev,
            modalInputs: { ...prev.modalInputs, [name]: stringValue },
          }));
        }
      },
      []
  );

  const handleModalSubmit = useCallback(
      async (e?: React.FormEvent<HTMLFormElement>) => {
        if (e) e.preventDefault();
        const { configItem, modalInputs } = modalState;

        if (!configItem || !organization?.id || !organization.org_short_id || !user?.id) return;

        setModalState((prev) => ({ ...prev, isProcessing: true }));

        try {
          if (configItem.processFunctionName === 'sampleGroup') {
            const { collectionDate, collectionTime, locCharId } = modalInputs;

            if (!collectionDate || !locCharId) {
              throw new Error('Collection date and location are required to create a sample group.');
            }

            const formattedDate = new Date(collectionDate).toISOString().split('T')[0];
            const baseName = `${formattedDate}-${locCharId}`;

            const existingNumbers = Object.values(sampleGroups)
                .filter((group) => group.org_id === organization.id)
                .map((group) => {
                  const regex = new RegExp(`^${baseName}-(\\d{2})-${organization.org_short_id}$`);
                  const match = group.human_readable_sample_id.match(regex);
                  return match ? parseInt(match[1], 10) : null;
                })
                .filter((num): num is number => num !== null);

            let nextNumber = 0;
            while (existingNumbers.includes(nextNumber)) {
              nextNumber += 1;
            }
            const formattedNumber = String(nextNumber).padStart(2, '0');

            const sampleGroupName = `${baseName}-${formattedNumber}-${organization.org_short_id}`;

            const location = locations.find((loc) => loc.char_id === locCharId);
            if (!location) {
              throw new Error(`Location with char_id ${locCharId} not found.`);
            }

            const rawDataFolderPath = `${organization.org_short_id}/${sampleGroupName}/`;
            const id: string = uuidv4();

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

            const sampleGroupData = {
              id,
              human_readable_sample_id: sampleGroupName,
              loc_id: location.id,
              storage_folder: rawDataFolderPath,
              collection_date: formattedDate,
              collection_datetime_utc: collectionTime ? `${collectionDate}T${collectionTime}Z` : undefined,
              user_id: user.id,
              org_id: organization.id,
              latitude_recorded: undefined,
              longitude_recorded: undefined,
              notes: undefined,
              created_at: new Date().toISOString(),
              updated_at: DateTime.now().toISO(),
            };

            await createSampleGroup(sampleGroupData, newNode);
            setErrorMessage('');
          } else if (configItem.processFunctionName === 'folder') {
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
      [modalState, organization, user, locations, sampleGroups, createSampleGroup, setErrorMessage, closeModal, fileTree, updateFileTree]
  );

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
            label: 'Collection Time (UTC)',
            type: 'time',
            tooltip: 'Optionally specify the time when the sample was collected. Leave blank if unknown.',
            required: false,
          },
          {
            name: 'locCharId',
            label: 'Location',
            type: 'location',
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

  const handleResetSelection = useCallback(() => {
    setSelectedLeftItem(undefined);
  }, [setSelectedLeftItem]);

  return (
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

            <Button
                variant="contained"
                onClick={handleResetSelection}
                aria-label="Reset Selection"
                sx={styles.resetButton}
                disableElevation
            >
              <PublicIcon />
              {!isLeftSidebarCollapsed && (
                  <span style={{ marginLeft: theme.spacing(1) }}>
                Reset Selection
              </span>
              )}
            </Button>
          </Box>

          <LeftSidebarTree />
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
      </Box>
  );
};

export default LeftSidebar;