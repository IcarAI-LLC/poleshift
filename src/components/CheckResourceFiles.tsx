import React, { useEffect } from "react";
import { exists } from "@tauri-apps/plugin-fs";
import { resourceDir, resolve } from "@tauri-apps/api/path";
import { download } from "@tauri-apps/plugin-upload";
import { useResourceDownloadContext } from "@/stores/ResourceDownloadContext.tsx";

function removeGzExtension(filename: string): string {
    return filename.endsWith(".gz") ? filename.slice(0, -3) : filename;
}

/**
 * Define the resources you want to ensure exist locally.
 * Each resource has:
 *  - fileName: local file name (compressed) in resource directory
 *  - url: the S3/HTTPS link to download from
 *  - headers (optional): any headers you want to send with the request
 */
const resourcesToEnsure = [
    {
        fileName: "database.kdb.gz",
        url: "https://example.com/database.kdb.gz",
        headers: { "Content-Type": "application/x-gzip" },
    },
    {
        fileName: "database.kdb.counts.gz",
        url: "https://example.com/database.kdb.counts.gz",
        headers: { "Content-Type": "application/x-gzip" },
    },
    {
        fileName: "database.idx.gz",
        url: "https://example.com/database.idx.gz",
        headers: { "Content-Type": "application/x-gzip" },
    },
    {
        fileName: "taxDB.gz",
        url: "https://example.com/taxDB.gz",
        headers: { "Content-Type": "application/x-gzip" },
    },
    // Add more files as needed
];

function toHeaderMap(obj?: Record<string, string>): Map<string, string> {
    const map = new Map<string, string>();
    if (obj) {
        Object.entries(obj).forEach(([key, value]) => {
            map.set(key, value);
        });
    }
    return map;
}

export const CheckResourceFiles: React.FC = () => {
    const { setDownloads } = useResourceDownloadContext();

    const checkAndDownloadFiles = async () => {
        try {
            const resourcePath = await resourceDir();

            for (const resource of resourcesToEnsure) {
                // Derive the "decompressed" filename by removing .gz
                const decompressedName = removeGzExtension(resource.fileName);

                // Paths
                const localDecompressedPath = await resolve(
                    resourcePath,
                    "resources",
                    decompressedName
                );
                const localCompressedPath = await resolve(
                    resourcePath,
                    "resources",
                    resource.fileName
                );

                // 1) Check if the decompressed file already exists
                const decompressedExists = await exists(localDecompressedPath);
                if (decompressedExists) {
                    console.log(
                        `Decompressed file ${localDecompressedPath} already exists. Skipping download.`
                    );
                    continue; // Move on to next resource
                }

                // 2) If not, you might decide to also skip download if the compressed file is already present:
                const compressedExists = await exists(localCompressedPath);
                if (compressedExists) {
                    console.log(
                        `Compressed file ${localCompressedPath} already exists (no new download).`
                    );
                    // At this point, you could decompress it (if needed) or leave it as is.
                    continue;
                }

                // 3) If the compressed file doesn't exist, download it
                console.log(`Downloading ${localCompressedPath} ...`);

                // Initialize this file's progress in context
                setDownloads((prev) => [
                    ...prev.filter((r) => r.fileName !== resource.fileName),
                    { fileName: resource.fileName, progress: 0, total: 0, transferSpeed: 0 },
                ]);

                const headerMap = toHeaderMap(resource.headers);

                // Perform the download
                await download(
                    resource.url,
                    localCompressedPath,
                    (progress: {
                        progress: number;
                        progressTotal: number;
                        transferSpeed: number;
                        total: number;
                    }) => {
                        // Update this file's progress in context
                        setDownloads((prev) =>
                            prev.map((item) => {
                                if (item.fileName === resource.fileName) {
                                    return {
                                        fileName: item.fileName,
                                        progress: progress.progress,
                                        total: progress.total,
                                        transferSpeed: progress.transferSpeed,
                                    };
                                }
                                return item;
                            })
                        );
                    },
                    headerMap
                );

                // Optionally remove the completed file from context
                setDownloads((prev) =>
                    prev.filter((r) => r.fileName !== resource.fileName)
                );

                // 4) (Optional) Decompress here if you want to automatically unzip
                //   - use your favorite unzipping library, or native Tauri commands
                //   - skip if you want to do decompression elsewhere
            }
        } catch (error) {
            console.error("Error checking/downloading resource files:", error);
        }
    };

    useEffect(() => {
        checkAndDownloadFiles();
    }, []);

    // Renders nothing; purely used for effect
    return null;
};

export default CheckResourceFiles;
