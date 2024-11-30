// Fix BaseService.ts type
//@ts-ignore
import {IndexedDBStorage} from "../storage/IndexedDB.ts";

/**
 * BaseService is an abstract class that provides a foundation for services interacting with IndexedDB storage.
 * It requires subclasses to specify a storage key and provides a common error handling mechanism.
 */
export abstract class BaseService {
    protected abstract storageKey: string;

    protected constructor(readonly storage: IndexedDBStorage) {}

    /**
     * Handles an error by logging it with a specified message and throwing a new error.
     *
     * @param error The error object that needs to be handled. It can be of any type.
     * @param message A descriptive message that provides context about the error.
     * @return This method never returns a value as it throws an error.
     */
    handleError(error: unknown, message: string): never {
        console.error(`${message}:`, error);
        throw new Error(message);
    }
}