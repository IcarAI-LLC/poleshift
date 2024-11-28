// types/services.ts
import type { NetworkService } from '../services/offline/NetworkService';
import type { OperationQueue } from '../services/offline/OperationQueue';
import type { SyncService } from '../services/SyncService';
import type { AuthService } from '../services/AuthService';
import type { DataService } from '../services/DataService';
import type { ProcessedDataService } from '../services/ProcessedDataService';
import {SyncManager} from "../services/offline";

export interface Services {
    auth: AuthService;
    data: DataService;
    sync: SyncService;
    processedData: ProcessedDataService;
    network: NetworkService;
    operationQueue: OperationQueue;
    syncManager: SyncManager;
}