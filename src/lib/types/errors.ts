export class AppError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'AppError';
    }
}

export class StorageError extends AppError {
    constructor(message: string, originalError?: any) {
        super(message, originalError);
        this.name = 'StorageError';
    }
}

export class SyncError extends AppError {
    constructor(message: string, originalError?: any) {
        super(message, originalError);
        this.name = 'SyncError';
    }
}