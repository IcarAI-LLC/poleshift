import React, { createContext, useReducer } from 'react';
import type { AppState, AppAction, Services } from '../types';
//@ts-ignore
import { IndexedDBStorage, storage } from '../storage/IndexedDB';
import { supabase } from '../supabase/client';
import { OperationQueue, SyncManager } from '../services/offline';
import {
    AuthService,
    DataService,
    SyncService,
    ProcessedDataService
} from '../services';
//@ts-ignore
import { networkService } from '../services/EnhancedNetworkService';
import { NetworkStateProvider } from './NetworkStateContext';

// Initialize services in the correct order
/**
 * Represents a queue that manages and processes a series of operations.
 *
 * The `operationQueue` variable is an instance of the `OperationQueue` class,
 * which utilizes a storage mechanism to enqueue and dequeue operations
 * for processing. The operations typically adhere to a predefined format or structure
 * that the queue can manage effectively. This queue is particularly useful in
 * scenarios where operations need to be processed in a controlled and orderly manner.
 *
 * It is initialized with a storage parameter, which defines the underlying data storage
 * mechanism or strategy used for maintaining the operations. This storage is critical
 * for managing the lifecycle of each operation within the queue, including its addition,
 * removal, and retrieval.
 *
 * `operationQueue` is designed to handle asynchronous operations, ensuring that
 * each operation is processed according to its sequence, which can help in
 * scenarios requiring transactional precision or task prioritization.
 *
 * This queue is an integral part of systems involving concurrent operation management,
 * enabling better resource utilization and throughput by organizing the workflow
 * of queued tasks.
 *
 * @type {OperationQueue}
 */
const operationQueue = new OperationQueue(storage);
/**
 * An instance of the SyncService class that manages synchronization tasks.
 *
 * The syncService variable is initialized with references to a Supabase client and a storage object.
 * It is responsible for coordinating data synchronization between the application and Supabase,
 * as well as handling file storage operations.
 *
 * Dependencies:
 * - Supabase: Used for managing the real-time database and authentication processes.
 * - Storage: Handles file storage, including uploading and retrieving files.
 *
 * The operations handled by syncService are typically crucial for ensuring that the application's
 * data state is consistent with the backend and that file assets are managed effectively.
 *
 * Usage of syncService typically involves methods provided by the SyncService class for
 * synchronization and storage operations.
 *
 * Assumes that both Supabase and Storage objects passed during initialization are
 * pre-configured and valid for the current application context.
 *
 * Properties, methods, and specific usage of the syncService object are defined by the
 * SyncService class.
 */
const syncService = new SyncService(supabase, storage);
/**
 * An instance of SyncManager responsible for managing synchronization operations.
 *
 * This object uses an operation queue and a synchronization service to coordinate
 * and execute sync-related tasks. It helps in ensuring data consistency across
 * different parts of the application by managing and executing the necessary
 * operations in an organized manner.
 *
 * @type {SyncManager}
 * @param {OperationQueue} operationQueue - The queue that holds the operations to be synchronized.
 * @param {SyncService} syncService - The service utilized for performing synchronization tasks.
 */
const syncManager = new SyncManager(operationQueue, syncService);
/**
 * An instance of the AuthService class, responsible for managing authentication-related operations.
 *
 * This service uses Supabase as the backend for authentication and may utilize storage for handling
 * session or credential data.
 *
 * Dependencies:
 * - Supabase: The primary service used for handling user authentication tasks such as login, logout,
 *   and user session management.
 * - Storage: Optional dependency designed for storing authentication data, session tokens or other
 *   required information persistently.
 *
 * Typical operations that `authService` might support include user login, logout, registration,
 * password reset, and session management.
 */
const authService = new AuthService(supabase, storage);
/**
 * An instance of the `DataService` class responsible for managing data operations.
 *
 * The `dataService` object is initialized with dependencies to handle data synchronization,
 * operation queuing, and storage management.
 *
 * Dependencies:
 * - `syncService`: Handles synchronization tasks with external data sources or services.
 * - `operationQueue`: Manages and queues operations to ensure they are executed in order.
 * - `storage`: Manages data storage, providing methods to store and retrieve data.
 *
 * This service is designed to facilitate seamless data handling by orchestrating between
 * synchronization processes, ensuring operations are executed correctly, and persisting
 * data efficiently with the provided storage mechanism. It's a critical part of the
 * data handling infrastructure, meant to simplify and unify data-related operations
 * in the application.
 *
 * Note: Proper initialization and configuration of dependencies are essential for the
 * correct functioning of the `dataService`.
 */
const dataService = new DataService(syncService, operationQueue, storage);
/**
 * processedDataService
 *
 * An instance of the ProcessedDataService class. This service is responsible for
 * managing and processing data using the provided synchronization service, operation
 * queue, and storage medium. It serves as a core component to handle the lifecycle
 * of data processing operations within the application.
 *
 * Dependencies:
 * - syncService: A service used for synchronizing data between different components
 *   or layers of the application.
 * - operationQueue: A queue structure to handle and prioritize operations that the
 *   service should perform on the data.
 * - storage: A storage medium that the service utilizes for storing and retrieving
 *   processed data efficiently.
 */
const processedDataService = new ProcessedDataService(
    syncService,
    operationQueue,
    storage
);

/**
 * Represents the initial state of the application.
 *
 * This state is used to define the default values for various sections of the application
 * including authentication, data management, processed data, and user interface settings.
 *
 * @typedef {Object} AppState
 * @property {Object} auth - Represents authentication-related information.
 * @property {Object|null} auth.user - Contains user details if authenticated, otherwise null.
 * @property {Object|null} auth.userProfile - Contains user profile information, or null if not available.
 * @property {Object|null} auth.organization - The organization data associated with the user.
 * @property {boolean} auth.loading - Indicates whether authentication-related operations are currently loading.
 * @property {Object|null} auth.error - Contains error information related to authentication, if any.
 *
 * @property {Object} data - Manages file and synchronization related data.
 * @property {Array} data.fileTree - Represents a hierarchical structure of files.
 * @property {Object} data.sampleGroups - Holds groupings of samples.
 * @property {Array} data.locations - A list of location data entries.
 * @property {boolean} data.isSyncing - Indicates if data synchronization is in progress.
 * @property {Date|null} data.lastSynced - Timestamp of the last successful data synchronization.
 * @property {Object|null} data.error - Contains error information related to data operations, if any.
 *
 * @property {Object} processedData - Manages data processing operations.
 * @property {Object} processedData.data - Holds processed data entries.
 * @property {Object} processedData.isProcessing - Tracks the processing state of various data sets.
 * @property {Object|null} processedData.error - Contains error information related to data processing, if any.
 * @property {Object} processedData.processedData - A repository of finalized processed data entries.
 * @property {Object} processedData.progressStates - Tracks the progress of various processing tasks.
 * @property {Object} processedData.uploadDownloadProgressStates - Monitors the progress of data upload and download tasks.
 *
 * @property {Object} ui - Represents the current state and settings of the user interface.
 * @property {Object|null} ui.selectedLeftItem - The currently selected item on the left panel, if any.
 * @property {Object|null} ui.selectedRightItem - The currently selected item on the right panel, if any.
 * @property {boolean} ui.isSidebarCollapsed - State indicating if the sidebar is collapsed.
 * @property {boolean} ui.isRightSidebarCollapsed - State indicating if the right sidebar is collapsed.
 * @property {boolean} ui.showAccountActions - Visibility state of account-related actions.
 * @property {string} ui.errorMessage - Error message to be displayed to the user, if any.
 * @property {Object} ui.filters - Filters applied within the application.
 * @property {Date|null} ui.filters.startDate - Start date filter, if set.
 * @property {Date|null} ui.filters.endDate - End date filter, if set.
 * @property {Array} ui.filters.selectedLocations - List of locations selected in the filter.
 * @property {Object} ui.modal - Information about the currently displayed modal dialog box.
 * @property {boolean} ui.modal.isOpen - Indicates if a modal is currently open.
 * @property {string} ui.modal.title - Title of the open modal.
 * @property {string} ui.modal.type - Type of modal dialog currently displayed.
 * @property {Object|undefined} ui.modal.configItem - Configuration information of the modal, if any.
 * @property {Object|undefined} ui.modal.modalInputs - Input fields within the modal, if any.
 * @property {Object|undefined} ui.modal.data - Data related to the modal usage, if any.
 * @property {Object} ui.contextMenu - State and information about the context menu.
 * @property {boolean} ui.contextMenu.isVisible - Indicates if the context menu is visible.
 * @property {number} ui.contextMenu.x - X-coordinate of the context menu position.
 * @property {number} ui.contextMenu.y - Y-coordinate of the context menu position.
 * @property {Object|null} ui.contextMenu.itemId - ID of the item for which the context menu is displayed, if applicable.
 */
const initialState: AppState = {
    auth: {
        user: null,
        userProfile: null,
        organization: null,
        loading: true,
        error: null
    },
    data: {
        fileTree: [],
        sampleGroups: {},
        locations: [],
        isSyncing: false,
        lastSynced: null,
        error: null
    },
    processedData: {
        data: {},
        isProcessing: {},
        error: null,
        processedData: {},
        progressStates: {},
        uploadDownloadProgressStates: {}
    },
    ui: {
        selectedLeftItem: null,
        selectedRightItem: null,
        isSidebarCollapsed: false,
        isRightSidebarCollapsed: false,
        showAccountActions: false,
        errorMessage: '',
        filters: {
            startDate: null,
            endDate: null,
            selectedLocations: []
        },
        modal: {
            isOpen: false,
            title: '',
            type: 'input',
            configItem: undefined,
            modalInputs: undefined,
            data: undefined
        },
        contextMenu: {
            isVisible: false,
            x: 0,
            y: 0,
            itemId: null
        }
    }
};

/**
 * The AppContext provides a context for managing the application's global state, dispatch actions,
 * and access a set of services throughout the component tree.
 *
 * Properties:
 * - state: An object representing the current state of the application.
 * - dispatch: A function for dispatching actions to update the application state.
 * - services: An object containing various services used across the application such as
 *   authentication, data management, synchronization, and operation queuing.
 *
 * This context is intended to be used with React's Context API to share the state, dispatch, and
 * services with any component that requires access to these features, thereby promoting a
 * centralized management of the application's state and operations.
 */
export const AppContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    services: Services;
}>({
    state: initialState,
    dispatch: () => null,
    services: {
        auth: authService,
        data: dataService,
        sync: syncService,
        processedData: processedDataService,
        operationQueue: operationQueue,
        syncManager: syncManager,
    }
});

/**
 * Reducer function for managing application state transitions based on dispatched actions.
 *
 * @param {AppState} state - The current state of the application.
 * @param {AppAction} action - An action object that specifies the type of action to be performed and an optional payload carrying data.
 * @return {AppState} The new state of the application after applying the specified action.
 */
function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        // Auth Actions
        case 'SET_USER':
            return {
                ...state,
                auth: { ...state.auth, user: action.payload }
            };
        case 'SET_USER_PROFILE':
            return {
                ...state,
                auth: { ...state.auth, userProfile: action.payload }
            };
        case 'SET_ORGANIZATION':
            return {
                ...state,
                auth: { ...state.auth, organization: action.payload }
            };
        case 'SET_AUTH_LOADING':
            return {
                ...state,
                auth: { ...state.auth, loading: action.payload }
            };
        case 'SET_AUTH_ERROR':
            return {
                ...state,
                auth: { ...state.auth, error: action.payload }
            };
        case 'CLEAR_AUTH':
            return {
                ...state,
                auth: {
                    user: null,
                    userProfile: null,
                    organization: null,
                    loading: false,
                    error: null
                }
            };

        // Data Actions
        case 'SET_FILE_TREE':
            return {
                ...state,
                data: { ...state.data, fileTree: action.payload }
            };
        case 'SET_SAMPLE_GROUPS':
            return {
                ...state,
                data: {
                    ...state.data,
                    sampleGroups: action.payload,
                },
            };
        case 'ADD_SAMPLE_GROUP':
            return {
                ...state,
                data: {
                    ...state.data,
                    sampleGroups: {
                        ...state.data.sampleGroups,
                        [action.payload.id]: action.payload
                    }
                }
            };
        case 'UPDATE_SAMPLE_GROUP':
            const updatedGroup = action.payload;
            return {
                ...state,
                data: {
                    ...state.data,
                    sampleGroups: {
                        ...state.data.sampleGroups,
                        [updatedGroup.id]: updatedGroup,
                    },
                },
            };
        case 'SET_SYNCING':
            return {
                ...state,
                data: { ...state.data, isSyncing: action.payload }
            };
        case 'SET_LAST_SYNCED':
            return {
                ...state,
                data: { ...state.data, lastSynced: action.payload }
            };
        case 'SET_DATA_ERROR':
            return {
                ...state,
                data: { ...state.data, error: action.payload }
            };
        case 'SET_LOCATIONS':
            return {
                ...state,
                data: {
                    ...state.data,
                    locations: action.payload
                }
            };

        // ProcessedData Actions
        case 'SET_PROCESSED_DATA':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    data: {
                        ...state.processedData.data,
                        [action.payload.key]: action.payload.data,
                    },
                },
            };
        case 'SET_PROCESSING_STATUS':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    isProcessing: {
                        ...state.processedData.isProcessing,
                        [action.payload.key]: action.payload.status
                    }
                }
            };
        case 'SET_PROCESSED_DATA_PROGRESS':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    progressStates: {
                        ...state.processedData.progressStates,
                        [action.payload.key]: {
                            progress: action.payload.progress,
                            status: action.payload.status,
                        },
                    },
                },
            };
        case 'SET_UPLOAD_DOWNLOAD_PROGRESS':
            return {
                ...state,
                processedData: {
                    ...state.processedData,
                    uploadDownloadProgressStates: {
                        ...state.processedData.uploadDownloadProgressStates,
                        [action.payload.key]: {
                            progress: action.payload.progress,
                            status: action.payload.status,
                        },
                    },
                },
            };
        // UI Actions
        case 'SET_SELECTED_LEFT_ITEM':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    selectedLeftItem: action.payload
                }
            };

        case 'SET_SELECTED_RIGHT_ITEM':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    selectedRightItem: action.payload
                }
            };

        case 'TOGGLE_SIDEBAR':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isSidebarCollapsed: action.payload !== undefined
                        ? action.payload
                        : !state.ui.isSidebarCollapsed
                }
            };

        case 'TOGGLE_RIGHT_SIDEBAR':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isRightSidebarCollapsed: action.payload !== undefined
                        ? action.payload
                        : !state.ui.isRightSidebarCollapsed
                }
            };

        case 'SET_SHOW_ACCOUNT_ACTIONS':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    showAccountActions: action.payload
                }
            };

        case 'SET_ERROR_MESSAGE':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    errorMessage: action.payload
                }
            };

        case 'SET_FILTERS':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    filters: action.payload
                }
            };

        case 'SET_MODAL_STATE':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    modal: action.payload
                }
            };

        case 'SET_CONTEXT_MENU_STATE':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    contextMenu: action.payload
                }
            };
        default:
            return state;
    }
}

// Updated AppProvider to include NetworkStateProvider
/**
 * Provides the application context and state management for its children components.
 * This function wraps its children components with necessary providers including network state
 * and app-specific services.
 *
 * @param {Object} props - The properties passed to this component.
 * @param {React.ReactNode} props.children - The child components to be wrapped with the AppProvider context.
 * @return {JSX.Element} A component wrapped with network state and application-specific providers.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    return (
        <NetworkStateProvider>
            <AppContext.Provider
                value={{
                    state,
                    dispatch,
                    services: {
                        auth: authService,
                        data: dataService,
                        sync: syncService,
                        processedData: processedDataService,
                        operationQueue: operationQueue,
                        syncManager: syncManager,
                    }
                }}
            >
                {children}
            </AppContext.Provider>
        </NetworkStateProvider>
    );
}