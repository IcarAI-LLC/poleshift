// EnhancedNetworkService.ts

import {supabase} from "../supabase/client.ts";

type NetworkListener = () => void;

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

    public static getInstance(): EnhancedNetworkService {
        if (!EnhancedNetworkService.instance) {
            EnhancedNetworkService.instance = new EnhancedNetworkService();
        }
        return EnhancedNetworkService.instance;
    }

    private initializeNetworkListeners() {
        window.addEventListener('online', () => this.handleOnlineStatusChange());
        window.addEventListener('offline', () => this.handleOnlineStatusChange());
    }

    private handleOnlineStatusChange() {
        if (navigator.onLine) {
            this.notifyOnlineListeners();
        } else {
            this.notifyOfflineListeners();
        }
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public onInitialized(callback: () => void): void {
        if (this.initialized) {
            callback();
        } else {
            this.initializationListeners.push(callback);
        }
    }

    public addOnlineListener(listener: NetworkListener): void {
        this.onlineListeners.push(listener);
    }

    public addOfflineListener(listener: NetworkListener): void {
        this.offlineListeners.push(listener);
    }

    public removeOnlineListener(listener: NetworkListener): void {
        this.onlineListeners = this.onlineListeners.filter(l => l !== listener);
    }

    public removeOfflineListener(listener: NetworkListener): void {
        this.offlineListeners = this.offlineListeners.filter(l => l !== listener);
    }

    private notifyOnlineListeners(): void {
        this.onlineListeners.forEach(listener => listener());
    }

    private notifyOfflineListeners(): void {
        this.offlineListeners.forEach(listener => listener());
    }

    public isOnline(): boolean {
        return navigator.onLine;
    }

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

    private async startNetworkChecks(): Promise<void> {
        if (this.checkInterval) return;

        await this.checkNetworkConnection();
        this.checkInterval = window.setInterval(
            () => this.checkNetworkConnection(),
            this.CHECK_INTERVAL_MS
        );
    }

    private async checkNetworkConnection(): Promise<void> {
        const isConnected = await this.hasActiveConnection();
        if (isConnected) {
            this.notifyOnlineListeners();
        } else {
            this.notifyOfflineListeners();
        }
    }

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
export const networkService = EnhancedNetworkService.getInstance();
