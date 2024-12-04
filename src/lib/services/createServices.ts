// Service factory
import { StorageService } from './storage/StorageService';
import { ApiService } from './api/ApiService';
import { SyncService } from './sync/SyncService';
import { UploadService } from './upload/UploadService';
import { QueueService } from './queue/QueueService';

export interface Services {
    storage: StorageService;
    api: ApiService;
    sync: SyncService;
    upload: UploadService;
    queue: QueueService;
}

export function createServices(
    storage: StorageService,
    api: ApiService
): Services {
    const queue = new QueueService(storage);
    const sync = new SyncService(api, storage);
    const upload = new UploadService(storage);

    return {
        storage,
        api,
        sync,
        upload,
        queue
    };
}