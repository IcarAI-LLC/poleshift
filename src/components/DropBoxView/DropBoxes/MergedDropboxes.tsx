import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

import { useAuth, useData, useUI } from '@/lib/hooks';
import { useAuthStore } from '@/lib/stores/authStore.ts';

import SingleDropBox from './SingleDropBox.tsx';

import dropboxConfig from '../../../config/dropboxConfig.ts';
import type { DropboxesProps } from './types.ts';
import { PoleshiftPermissions } from '@/lib/types';
import {FileNodeType} from "@/lib/powersync/DrizzleSchema.ts";

const MergedDropBoxes: React.FC<DropboxesProps> = ({ onError }) => {
    // All hooks at the top level
    const { selectedLeftItem } = useUI();
    const { sampleGroups, getLocationById } = useData();
    const { organization } = useAuth();
    const userPermissions = useAuthStore((state) => state.userPermissions);

    // Derived state calculations
    const sampleGroupId =
        selectedLeftItem?.type === FileNodeType.SampleGroup ? selectedLeftItem.id : null;

    const hasModifyPermission = userPermissions?.includes(
        PoleshiftPermissions.ModifySampleGroup
    );

    // Memoized sampleGroup and location
    const { sampleGroup} = useMemo(() => {
        if (!sampleGroupId) {
            return { sampleGroup: null };
        }
        const currentSampleGroup = sampleGroups[sampleGroupId];
        return {
            sampleGroup: currentSampleGroup || null,
        };
    }, [sampleGroupId, sampleGroups, getLocationById]);

    // Style for each drop box
    const boxStyles = useMemo(() => ({
        width: {
            xs: '100%',
            sm: 'calc(50% - var(--spacing-md))',
            md: 'calc(33.333% - var(--spacing-md))',
        },
    }), []);

    // Render
    if (!sampleGroup) {
        return (
            <Typography
                variant="body1"
                sx={{
                    color: 'text.secondary',
                    textAlign: 'center',
                    width: '100%',
                    padding: 2,
                }}
            >
                Please select a sample group to view DropBoxes.
            </Typography>
        );
    }

    return (
        <Box className="dropBoxes" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {dropboxConfig
                .filter((configItem) => configItem?.isEnabled)
                .map((configItem) => {
                    // If user doesn't have modify permission, "lock" the box unless we want read-only access for existing data
                    // In many flows, if you cannot modify, you also cannot upload new data, so we treat it as locked.
                    const locked = !hasModifyPermission;

                    return (
                        <Box key={configItem.id} sx={boxStyles}>
                            <SingleDropBox
                                configItem={configItem}
                                sampleGroup={sampleGroup}
                                organization={organization}
                                isLocked={locked}
                                onError={onError}
                            />
                        </Box>
                    );
                })}
        </Box>
    );
};

export default MergedDropBoxes;
