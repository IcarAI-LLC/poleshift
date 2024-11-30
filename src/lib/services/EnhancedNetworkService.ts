// EnhancedNetworkService.ts

import {supabase} from "../supabase/client.ts";

/**
 * A type definition for a callback function intended to be used as a listener
 * for network-related events. The function does not take any arguments and
 * does not return a value.
 *
 * Common use cases involve assigning this type to functions that react to
 * changes in network connectivity, such as when the network goes online
 * or offline.
 */
type NetworkListener = () => void;

/**
 * The EnhancedNetworkService class is a singleton responsible for monitoring network connectivity
 * states and notifying registered listeners of changes to online and offline status.
 */
export class EnhancedNetworkService {
    private static instance: EnhancedNetworkService;
    private checkInterval: number | null = null;
    private readonly CHECK_INTERVAL_MS = 10000; // 10 seconds
    private initialized = false;
    private initializationListeners: (() => void)[] = [];
    private onlineListeners: NetworkListener[] = [];
    private offlineListeners: NetworkListener[] = [];

    private constructor() {
        this.initializeNetworkListeners();
    }

    /**
     * Retrieves the singleton instance of the EnhancedNetworkService class.
     * If no instance exists, a new one will be created and returned.
     *
     * @return {EnhancedNetworkService} The singleton instance of the EnhancedNetworkService.
     */
    public static getInstance(): EnhancedNetworkService {
        if (!EnhancedNetworkService.instance) {
            EnhancedNetworkService.instance = new EnhancedNetworkService();
        }
        return EnhancedNetworkService.instance;
    }

    /**
     * Sets up network listeners to monitor changes in online and offline status.
     * This method adds event listeners for the 'online' and 'offline' events on the window object,
     * triggering the handleOnlineStatusChange method whenever the network status changes.
     *
     * @return {void} This method does not return a value.
     */
    private initializeNetworkListeners() {
        window.addEventListener('online', () => this.handleOnlineStatusChange());
        window.addEventListener('offline', () => this.handleOnlineStatusChange());
    }

    /**
     * Handles the change in online status by checking the current state of the navigator.
     * It will notify the appropriate listeners based on the online status of the browser.
     * When the browser is online, it calls `notifyOnlineListeners()`.
     * When the browser is offline, it calls `notifyOfflineListeners()`.
     *
     * @return {void} This method does not return any value.
     */
    private handleOnlineStatusChange() {
        if (navigator.onLine) {
            this.notifyOnlineListeners();
        } else {
            this.notifyOfflineListeners();
        }
    }

    /**
     * Checks if the object has been initialized.
     *
     * @return {boolean} True if the object is initialized; otherwise, false.
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Registers a callback function to be executed when the object is initialized.
     * If the object is already initialized, the callback is executed immediately.
     * Otherwise, the callback is stored for later execution.
     *
     * @param callback - A function to be called when initialization is complete.
     * @return void
     */
    public onInitialized(callback: () => void): void {
        if (this.initialized) {
            callback();
        } else {
            this.initializationListeners.push(callback);
        }
    }

    /**
     * Adds a listener that will be notified when the network status changes to online.
     * The provided listener will be invoked whenever an online event is detected.
     *
     * @param {NetworkListener} listener - The function that will be called when the network status changes to online.
     * @return {void} This method does not return any value.
     */
    public addOnlineListener(listener: NetworkListener): void {
        this.onlineListeners.push(listener);
    }

    /**
     * Adds a listener to the offline listeners array. This listener will be
     * notified when the application's network status changes to offline.
     *
     * @param {NetworkListener} listener - A listener function to be executed when
     * the network status changes to offline.
     * @return {void} This method does not return a value.
     */
    public addOfflineListener(listener: NetworkListener): void {
        this.offlineListeners.push(listener);
    }

    /**
     * Removes a specified listener from the list of online listeners.
     *
     * @param {NetworkListener} listener - The listener to be removed from the online listeners list.
     * @return {void} Does not return a value.
     */
    public removeOnlineListener(listener: NetworkListener): void {
        this.onlineListeners = this.onlineListeners.filter(l => l !== listener);
    }

    /**
     * Removes a specified listener from the collection of offline listeners.
     * This prevents the listener from being notified of future offline events.
     *
     * @param {NetworkListener} listener - The listener to be removed from the offline listeners list.
     * @return {void} This method does not return any value.
     */
    public removeOfflineListener(listener: NetworkListener): void {
        this.offlineListeners = this.offlineListeners.filter(l => l !== listener);
    }

    /**
     * Notifies all registered online listeners.
     * This method iterates over the collection of listeners and
     * invokes each one. It is typically used to alert the relevant
     * components or systems that a change in online status has occurred.
     *
     * @return {void} Does not return a value.
     */
    private notifyOnlineListeners(): void {
        this.onlineListeners.forEach(listener => listener());
    }

    /**
     * Notifies all registered listeners that the system is offline by invoking
     * each listener function stored in the offlineListeners array.
     *
     * @return {void} Does not return any value.
     */
    private notifyOfflineListeners(): void {
        this.offlineListeners.forEach(listener => listener());
    }

    /**
     * Checks if the application is currently online.
     *
     * @return {boolean} True if the application has an active internet connection, otherwise false.
     */
    public isOnline(): boolean {
        return navigator.onLine;
    }

    /**
     * Checks if there is an active internet connection.
     *
     * This method first verifies the online status using the browser's `navigator.onLine` property.
     * If the browser is online, it attempts to invoke a backend function to further confirm connectivity.
     * The backend call can be customized to use a specific backend endpoint.
     *
     * @return {Promise<boolean>} A promise that resolves to `true` if there is an active connection, otherwise `false`.
     */
    public async hasActiveConnection(): Promise<boolean> {
        if (!navigator.onLine) {
            return false;
        }
        try {
            // Use your own backend or a public API that supports CORS
            const response = await supabase.functions.invoke('check-connection')
            if (response.data){
                return true;
            }
            else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * Initializes the network service if not already initialized.
     * This method performs necessary network checks and informs any registered listeners upon successful initialization.
     * It logs an error message if the initialization process fails.
     *
     * @return {Promise<void>} A promise that resolves when the initialization process is complete.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.startNetworkChecks();
            this.initialized = true;
            this.initializationListeners.forEach(listener => listener());
            this.initializationListeners = [];
        } catch (error) {
            console.error('Failed to initialize network service:', error);
        }
    }

    /**
     * Initializes the network checks by setting up a recurring interval task.
     * This method starts by checking the network connection immediately,
     * and then continues to perform the check at a regular interval defined by CHECK_INTERVAL_MS.
     * If the interval for network checks is already set, the method returns without any action.
     *
     * @return {Promise<void>} A promise that resolves once the initial network check is completed.
     */
    private async startNetworkChecks(): Promise<void> {
        if (this.checkInterval) return;

        await this.checkNetworkConnection();
        this.checkInterval = window.setInterval(
            () => this.checkNetworkConnection(),
            this.CHECK_INTERVAL_MS
        );
    }

    /**
     * Checks the current network connection status and notifies the appropriate listeners.
     * This method asynchronously determines if there is an active network connection.
     * If a connection is detected, it triggers the listeners associated with an online status.
     * If no connection is detected, it triggers the listeners associated with an offline status.
     * @return {Promise<void>} A promise that resolves when the network connection
     * status has been checked and the relevant listeners have been notified.
     */
    private async checkNetworkConnection(): Promise<void> {
        const isConnected = await this.hasActiveConnection();
        if (isConnected) {
            this.notifyOnlineListeners();
        } else {
            this.notifyOfflineListeners();
        }
    }

    /**
     * Destroys the current instance by clearing any active intervals and resetting state variables.
     * It removes all event listeners for online and offline events and marks the instance as uninitialized.
     * @return {void} This method does not return a value.
     */
    public destroy(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.onlineListeners = [];
        this.offlineListeners = [];
        this.initialized = false;
    }
}

// Export an instance of the network service
/**
 * An instance of the EnhancedNetworkService class, providing
 * access to a Singleton object that manages network operations.
 * This instance allows for efficient handling of network-related
 * tasks such as data fetching, sending requests, and receiving
 * responses while ensuring that only one instance of the service
 * exists throughout the application lifecycle.
 *
 * The networkService can be utilized to perform asynchronous
 * network requests with various configurations, optimizing
 * resource usage and maintaining consistent network operation
 * logic through centralized management.
 */
export const networkService = EnhancedNetworkService.getInstance();
