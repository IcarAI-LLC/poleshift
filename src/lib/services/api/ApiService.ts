import type {
    User,
    UserProfile,
    Organization,
    SampleGroupMetadata,
    FileNode,
    SampleLocation,
    ProcessedDataEntry
} from '../../types/index.ts';

export interface ApiService {
    // Auth
    signIn(email: string, password: string): Promise<{
        user: User;
        session: any;
    }>;
    signUp(email: string, password: string, licenseKey: string): Promise<void>;
    signOut(): Promise<void>;
    resetPassword(email: string): Promise<void>;
    getSession(): Promise<any>;
    getCurrentUser(): Promise<User | null>;

    // User & Organization
    getUserProfile(userId: string): Promise<UserProfile>;
    getOrganization(orgId: string): Promise<Organization>;

    // Data Operations
    createSampleGroup(data: SampleGroupMetadata): Promise<void>;
    updateSampleGroup(data: SampleGroupMetadata): Promise<void>;
    deleteSampleGroup(id: string): Promise<void>;

    createFileNode(data: FileNode): Promise<void>;
    updateFileNode(data: FileNode): Promise<void>;
    deleteFileNode(id: string): Promise<void>;

    // Sync Operations
    syncFromRemote(table: string, orgId?: string, since?: number): Promise<any[]>;
    syncToRemote(data: any, table: string): Promise<void>;
    verifySync(table: string, id: string): Promise<boolean>;

    // Processed Data
    syncProcessedData(entry: ProcessedDataEntry): Promise<void>;

    // File Operations
    uploadFile(file: File, path: string): Promise<string>;
    downloadFile(path: string): Promise<Blob>;

    // Locations
    getLocations(): Promise<SampleLocation[]>;
    updateLocation(location: SampleLocation): Promise<void>;
}