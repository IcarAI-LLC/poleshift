// lib/services/offline/NetworkService.ts
export class NetworkService {
    private onlineCallbacks: Set<() => void> = new Set();
    private offlineCallbacks: Set<() => void> = new Set();

    constructor() {
        this.initialize();
    }

    private initialize() {
        window.addEventListener('online', () => this.notifyOnline());
        window.addEventListener('offline', () => this.notifyOffline());
    }

    public onOnline(callback: () => void): () => void {
        this.onlineCallbacks.add(callback);
        return () => this.onlineCallbacks.delete(callback);
    }

    public onOffline(callback: () => void): () => void {
        this.offlineCallbacks.add(callback);
        return () => this.offlineCallbacks.delete(callback);
    }

    private notifyOnline() {
        this.onlineCallbacks.forEach(callback => callback());
    }

    private notifyOffline() {
        this.offlineCallbacks.forEach(callback => callback());
    }

    public isOnline(): boolean {
        return navigator.onLine;
    }
}