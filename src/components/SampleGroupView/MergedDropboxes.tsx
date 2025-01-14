
import { useMemo } from "react";
import SingleDropBox from "./SingleDropBox.tsx";

import { useAuth, useData, useUI } from "@/hooks";
import { useAuthStore } from "@/stores/authStore.ts";
import { PoleshiftPermissions, SampleGroupMetadata } from "@/types";
import dropboxConfig from "@/config/dropboxConfig.ts";
import { FileNodeType } from "@/lib/powersync/DrizzleSchema.ts";

interface DropboxesProps {
    onError: (message: string) => void;
}

export default function MergedDropBoxes({ onError }: DropboxesProps) {
    // Hooks
    const { selectedLeftItem } = useUI();
    const { sampleGroups, getLocationById, loading } = useData();
    const { organization } = useAuth();
    const userPermissions = useAuthStore((state) => state.userPermissions);

    // Permissions
    const hasModifyPermission = userPermissions?.includes(
        PoleshiftPermissions.ModifySampleGroup
    );

    // Identify the sample group from the left sidebar selection
    const sampleGroupId =
        selectedLeftItem?.type === FileNodeType.SampleGroup
            ? selectedLeftItem?.id
            : null;

    // Memoize the sample group
    const sampleGroup = useMemo<SampleGroupMetadata | null>(() => {
        if (!sampleGroupId) return null;
        return sampleGroups[sampleGroupId] || null;
    }, [sampleGroupId, sampleGroups, getLocationById]);

    if (loading) {
        return (
            <p className="text-sm text-gray-500 text-center w-full p-2">
                Loading...
            </p>
        );
    }
    // If no sample group, prompt the user to select one
    if (!sampleGroup) {
        return (
            <p className="text-sm text-gray-500 text-center w-full p-2">
                Please select a sample group to view DropBoxes.
            </p>
        );
    }

    // Render each dropbox config item (only if `isEnabled`)
    return (
        /**
         * Updated for 3 columns:
         *  - 1 column on mobile
         *  - 2 columns on small screens
         *  - 3 columns on medium+
         */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10">
            {dropboxConfig
                .filter((configItem) => configItem.isEnabled)
                .map((configItem) => {
                    // Lock if user doesn't have modify permission
                    const locked = !hasModifyPermission;

                    return (
                        <SingleDropBox
                            key={configItem.id}
                            configItem={configItem}
                            sampleGroup={sampleGroup}
                            organization={organization}
                            isLocked={locked}
                            onError={onError}
                        />
                    );
                })}
        </div>
    );
}
