export class StorageError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'StorageError';
    }
}

export class APIError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'APIError';
    }
}

export class SyncError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'SyncError';
    }
}

export class ValidationError extends Error {
    constructor(
        message: string,
        public validationErrors: ValidationError[],
        public originalError?: any
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}