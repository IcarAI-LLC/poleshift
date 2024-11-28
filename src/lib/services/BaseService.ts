// Fix BaseService.ts type
//@ts-ignore
import {IndexedDBStorage} from "../storage/IndexedDB.ts";

export abstract class BaseService {
    protected abstract storageKey: string;

    protected constructor(readonly storage: IndexedDBStorage) {}

    handleError(error: unknown, message: string): never {
        console.error(`${message}:`, error);
        throw new Error(message);
    }
}