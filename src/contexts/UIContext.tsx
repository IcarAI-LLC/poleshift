// src/renderer/contexts/UIContext.tsx

import React, {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';

// Define the structure for filter fields
interface Filters {
  startDate: string | null; // ISO date string
  endDate: string | null; // ISO date string
  selectedLocations: string[]; // Array of location IDs
}

// Define the structure for individual fields in modals
interface Field {
  name: string;
  label?: string; // Made label optional
  type: string; // 'text', 'textarea', 'select', etc.
  options?: string[]; // Only for 'select' type
}

// Define the structure for modal state
interface ModalState {
  isOpen: boolean;
  title: string;
  callback: (() => void) | null;
  fields: Field[];
}

// Define the structure for confirmation dialogs
interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  callback: (() => void) | null;
}

// Define the structure for context menus
interface ContextMenuState {
  isVisible: boolean;
  x: number;
  y: number;
  itemId: string | null;
}

// Define the structure of the UI context
export interface UIContextType {
  // Sidebar States
  selectedLeftItem: any; // Left sidebar (sampling event)
  setSelectedLeftItem: React.Dispatch<React.SetStateAction<any>>;
  selectedRightItem: any; // Right sidebar (location)
  setSelectedRightItem: React.Dispatch<React.SetStateAction<any>>;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isRightSidebarCollapsed: boolean;
  toggleRightSidebar: () => void;
  openRightSidebar: () => void; // **New Method**
  closeRightSidebar: () => void; // **New Method**

  // Modal States
  modalState: ModalState;
  openModal: (title: string, fields: Field[], callback?: () => void) => void;
  closeModal: () => void;

  // Confirmation Dialog States
  confirmState: ConfirmState;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;

  // Context Menu States
  contextMenuState: ContextMenuState;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState>>;

  // Account Actions
  showAccountActions: boolean;
  setShowAccountActions: React.Dispatch<React.SetStateAction<boolean>>;

  // Error Handling
  errorMessage: string;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;

  // Filter States
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}

// Create the UI context
export const UIContext = createContext<UIContextType | undefined>(undefined);

interface UIProviderProps {
  children: ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  // Sidebar States
  const [selectedLeftItem, setSelectedLeftItem] = useState<any>(null); // For left sidebar (sampling events)
  const [selectedRightItem, setSelectedRightItem] = useState<any>(null); // For right sidebar (locations)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] =
    useState<boolean>(
      true, // **Initialize as collapsed**
    );

  // Modal States
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    callback: null,
    fields: [],
  });

  // Confirmation Dialog States
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    callback: null,
  });

  // Context Menu States
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    isVisible: false,
    x: 0,
    y: 0,
    itemId: null,
  });

  // Account Actions
  const [showAccountActions, setShowAccountActions] = useState<boolean>(false);

  // Error Handling
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Filter States
  const [filters, setFilters] = useState<Filters>({
    startDate: null,
    endDate: null,
    selectedLocations: [],
  });

  // Memoize functions to prevent them from being recreated on every render
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setIsRightSidebarCollapsed((prev) => !prev);
  }, []);

  const openRightSidebar = useCallback(() => {
    setIsRightSidebarCollapsed(false);
  }, []);

  const closeRightSidebar = useCallback(() => {
    setIsRightSidebarCollapsed(true);
  }, []);

  const openModal = useCallback(
    (title: string, fields: Field[], callback?: () => void) => {
      setModalState({
        isOpen: true,
        title,
        fields,
        callback: callback || null,
      });
    },
    [],
  );

  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      title: '',
      fields: [],
      callback: null,
    });
  }, []);

  // Memoize the context value to optimize performance
  const value = useMemo(
    () => ({
      // Sidebar States
      selectedLeftItem,
      setSelectedLeftItem,
      selectedRightItem,
      setSelectedRightItem,
      isSidebarCollapsed,
      toggleSidebar,
      isRightSidebarCollapsed,
      toggleRightSidebar,
      openRightSidebar, // **Include in context**
      closeRightSidebar, // **Include in context**

      // Modal States
      modalState,
      openModal,
      closeModal,

      // Confirmation Dialog States
      confirmState,
      setConfirmState,

      // Context Menu States
      contextMenuState,
      setContextMenuState,

      // Account Actions
      showAccountActions,
      setShowAccountActions,

      // Error Handling
      errorMessage,
      setErrorMessage,

      // Filter States
      filters,
      setFilters,
    }),
    [
      selectedLeftItem,
      setSelectedLeftItem,
      selectedRightItem,
      setSelectedRightItem,
      isSidebarCollapsed,
      toggleSidebar,
      isRightSidebarCollapsed,
      toggleRightSidebar,
      openRightSidebar,
      closeRightSidebar,
      modalState,
      openModal,
      closeModal,
      confirmState,
      setConfirmState,
      contextMenuState,
      setContextMenuState,
      showAccountActions,
      setShowAccountActions,
      errorMessage,
      setErrorMessage,
      filters,
      setFilters,
    ],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
