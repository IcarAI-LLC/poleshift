// File: CheckResourceFiles.tsx
import React, { useEffect } from "react";
import { exists } from "@tauri-apps/plugin-fs";
import { resourceDir, resolve } from "@tauri-apps/api/path";
import { download } from "@tauri-apps/plugin-upload";
import {useResourceDownloadContext} from "@/stores/ResourceDownloadContext.tsx";


/**
 * Define the resources you want to ensure exist locally.
 * Each resource has:
 *  - fileName: local file name in resource directory
 *  - url: the S3 or HTTPS link to download from
 *  - headers (optional): any headers you want to send with the request (plain object)
 */
const resourcesToEnsure = [
    {
        fileName: "database.kdb.gz",
        url: "https://pvikwknnxcuuhiwungqh.supabase.co/storage/v1/object/public/application-dist/taxdb_v01/database.kdb.gz?t=2025-01-12T00%3A52%3A44.191Z",
        headers: { "Content-Type": "application/x-gzip" },
    },
    {
        fileName: "database.kdb.counts.gz",
        url: "https://pvikwknnxcuuhiwungqh.supabase.co/storage/v1/object/public/application-dist/taxdb_v01/database.kdb.counts.gz",
        headers: { "Content-Type": "application/x-gzip" },
    },
    {
        fileName: "database.idx.gz",
        url: "https://pvikwknnxcuuhiwungqh.supabase.co/storage/v1/object/public/application-dist/taxdb_v01/database.idx.gz?t=2025-01-12T00%3A49%3A55.601Z",
        headers: { "Content-Type": "application/x-gzip" },
    },
    {
        fileName: "taxDB.gz",
        url: "https://pvikwknnxcuuhiwungqh.supabase.co/storage/v1/object/public/application-dist/taxdb_v01/taxDB.gz",
        headers: { "Content-Type": "application/x-gzip" },
    }
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
                const localFilePath = await resolve(`${resourcePath}`,'resources',`${resource.fileName}`);
                const fileAlreadyExists = await exists(localFilePath);
                console.log(`Checking if file exists: ${localFilePath}`);
                console.log(fileAlreadyExists);
                if (!fileAlreadyExists) {
                    console.log(`File not found: ${localFilePath}. Downloading...`);

                    // Initialize this file's progress in context
                    setDownloads((prev) => [
                        ...prev.filter((r) => r.fileName !== resource.fileName),
                        { fileName: resource.fileName, progress: 0, total: 0, transferSpeed: 0 },
                    ]);

                    const headerMap = toHeaderMap(resource.headers);

                    await download(
                        resource.url,
                        localFilePath,
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

                            console.log(
                                `Downloading "${resource.fileName}": ` +
                                `${progress.progress} of ${progress.total} bytes`
                            );
                        },
                        headerMap
                    );

                    console.log(`Successfully downloaded "${resource.fileName}".`);
                    // You might optionally remove it from context once done, or leave it
                    // so you can show "all done" stats. Example:
                    setDownloads((prev) => prev.filter((r) => r.fileName !== resource.fileName));
                } else {
                    console.log(`File already exists: ${localFilePath}`);
                }
            }
        } catch (error) {
            console.error("Error checking/downloading resource files:", error);
        }
    };

    useEffect(() => {
        checkAndDownloadFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Renders nothing; purely used for effect
    return null;
};

export default CheckResourceFiles;