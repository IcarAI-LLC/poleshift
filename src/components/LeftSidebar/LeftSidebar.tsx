import React, { useCallback, useState } from 'react';
import {Box, Button, IconButton, SelectChangeEvent, Tooltip, useTheme} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import MenuIcon from '@mui/icons-material/Menu';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import Modal from '../Modal';
import AccountButton from './AccountButton';
import LeftSidebarTree from './LeftSidebarTree';
import useData from '../../old_hooks/useData';
import useUI from '../../old_hooks/useUI';
import { DropboxConfigItem } from '../../config/dropboxConfig';

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

const LeftSidebar: React.FC<LeftSidebarProps> = ({ }) => {
  const { addItem, isSyncing, locations } = useData();
  const theme = useTheme();

  const {
    isSidebarCollapsed,
    toggleSidebar,
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

  const openModal = (
    title: string,
    configItem: DropboxConfigItem,
    uploadedFiles: File[] = [],
  ) => {
    if (configItem.modalFields && configItem.modalFields.length > 0) {
      setModalState({
        isOpen: true,
        title,
        configItem,
        modalInputs: {},
        uploadedFiles,
        isProcessing: false,
      });
    }
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      configItem: null,
      modalInputs: {},
      uploadedFiles: [],
      isProcessing: false,
    });
  };

  const handleModalChange = (
      e:
          | React.ChangeEvent<HTMLTextAreaElement>
          | React.ChangeEvent<{ name?: string; value: unknown }>
          | SelectChangeEvent,
  ) => {
    const { name, value } = e.target;

    if (typeof name === 'string') {
      // Ensure value is a string
      const stringValue = typeof value === 'string' ? value : String(value);

      setModalState((prevState) => ({
        ...prevState,
        modalInputs: {
          ...prevState.modalInputs,
          [name]: stringValue,
        },
      }));
    } else {
      console.warn('Input element is missing a name attribute.');
    }
  };




  const handleModalSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const { configItem, modalInputs } = modalState;

    setModalState((prev) => ({
      ...prev,
      isProcessing: true,
    }));

    try {
      if (configItem?.processFunctionName && configItem?.processFunctionName === "folder" ||  configItem?.processFunctionName === "sampleGroup") {
        await addItem(configItem.processFunctionName, modalInputs);
        setErrorMessage('');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
    } finally {
      setModalState((prev) => ({
        ...prev,
        isProcessing: false,
      }));
      closeModal();
    }
  };

  const handleCreateSampleGroup = useCallback(() => {
    const configItem: DropboxConfigItem = {
      dataType: "", expectedFileTypes: null, isEnabled: false, isModalInput: false, label: "",
      id: 'create-sampleGroup',
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
          name: 'collectionTimeZone',
          label: 'Time Zone',
          type: 'timezone',
          tooltip: 'Select the time zone of the collection time.',
          required: !!modalState.modalInputs.collectionTime,
        },
        {
          name: 'locCharId',
          label: 'Location',
          type: 'select',
          options: locations.map((loc) => ({
            value: loc.char_id,
            label: loc.label,
          })),
          tooltip: 'Select the location where the sample was collected.',
          required: true,
        },
      ],
      processFunctionName: 'sampleGroup'
    };

    openModal('Create New Sampling Event', configItem);
  }, [locations, modalState.modalInputs.collectionTime]);

  const handleCreateFolder = useCallback(() => {
    const configItem: DropboxConfigItem = {
      dataType: "", expectedFileTypes: null, isEnabled: false, isModalInput: false, label: "",
      id: 'create-folder',
      modalFields: [{ name: 'name', label: 'Folder Name', type: 'text' }],
      processFunctionName: 'folder'
    };

    openModal('Create New Folder', configItem);
  }, []);

  const sidebarButtonStyle = {
    width: '100%',
    justifyContent: 'flex-start',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
  };

  const toggleButtonStyle = {
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
  };

  return (
    <>
      {/* Header Controls */}
      <Box className="sidebar-controls">
        <IconButton
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          sx={toggleButtonStyle}
        >
          <MenuIcon />
        </IconButton>

        <Box
          sx={{
            position: 'fixed',
            top: 'var(--spacing-sm)',
            left: '50px',
            padding: '8px',
            zIndex: 1001,
          }}
        >
          <Tooltip title={isSyncing ? 'Syncing data...' : 'All changes saved'}>
            <SyncIcon
              className={isSyncing ? 'syncing' : ''}
              sx={{
                fontSize: 24,
                fill: isSyncing ? '#f44336' : '#4caf50',
              }}
            />
          </Tooltip>
        </Box>

        <AccountButton setShowAccountActions={setShowAccountActions} />
      </Box>

      {/* Sidebar Container */}
      <Box
        className={`left-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
        sx={{
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
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'var(--header-height)',
          }}
        >
          {/* Action Buttons */}
          <Box
            sx={{
              padding: theme.spacing(2),
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing(1),
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <Button
              variant="contained"
              onClick={handleCreateSampleGroup}
              aria-label="Create New Sampling Event"
              sx={sidebarButtonStyle}
              disableElevation
            >
              <AddCircleIcon />
              {!isSidebarCollapsed && (
                <span style={{ marginLeft: theme.spacing(1) }}>
                  New Sampling Event
                </span>
              )}
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateFolder}
              aria-label="Create New Folder"
              sx={sidebarButtonStyle}
              disableElevation
            >
              <CreateNewFolderIcon />
              {!isSidebarCollapsed && (
                <span style={{ marginLeft: theme.spacing(1) }}>New Folder</span>
              )}
            </Button>
          </Box>

          {/* Tree View */}
          <LeftSidebarTree />
        </Box>
      </Box>

      {/* Modal */}
      {modalState.isOpen && modalState.configItem && (
        <Modal
          isOpen={modalState.isOpen}
          title={modalState.title}
          onClose={closeModal}
          modalFields={modalState.configItem.modalFields}
          modalInputs={modalState.modalInputs}
          handleModalChange={handleModalChange}
          handleModalSubmit={handleModalSubmit}
          isProcessing={modalState.isProcessing}
        />
      )}
    </>
  );
};

export default LeftSidebar;
