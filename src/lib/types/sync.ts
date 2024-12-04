export interface PendingOperation {
    id: string;
    type: 'create' | 'update' | 'delete' | 'upsert';
    table: string;
    data: any;
    timestamp: number;
    retryCount: number;
}