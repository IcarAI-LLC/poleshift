import {
    createContext,
    useContext,
    useState,
    ReactNode,
    useMemo,
    Dispatch,
    SetStateAction
} from "react";

interface ResourceProgress {
    fileName: string;
    progress: number;       // Number of bytes downloaded so far
    total: number;          // Total bytes (or 0 if unknown)
    transferSpeed: number;  // Bytes/sec (or 0 if unknown)
}

/** The shape of the context data we want to share */
interface ResourceDownloadContextType {
    /** Is at least one file currently downloading? */
    isDownloading: boolean;

    /** An array of current file progress objects */
    downloads: ResourceProgress[];

    /** A setter so that the CheckResourceFiles can update progress as it downloads */
    setDownloads: Dispatch<SetStateAction<ResourceProgress[]>>;
}

const ResourceDownloadContext = createContext<ResourceDownloadContextType | undefined>(
    undefined
);

export function ResourceDownloadProvider({ children }: { children: ReactNode }) {
    const [downloads, setDownloads] = useState<ResourceProgress[]>([]);

    // If any file has progress < total, we consider ourselves "downloading"
    const isDownloading = downloads.some(
        (item) => item.progress < item.total && item.total > 0
    );

    const value = useMemo(
        () => ({
            isDownloading,
            downloads,
            setDownloads,
        }),
        [isDownloading, downloads]
    );

    return (
        <ResourceDownloadContext.Provider value={value}>
            {children}
        </ResourceDownloadContext.Provider>
    );
}

export function useResourceDownloadContext() {
    const context = useContext(ResourceDownloadContext);
    if (!context) {
        throw new Error(
            "useResourceDownloadContext must be used within a ResourceDownloadProvider"
        );
    }
    return context;
}
