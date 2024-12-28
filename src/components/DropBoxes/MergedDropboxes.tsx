import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

import { useAuth, useData, useUI } from '../../lib/hooks';
import { useAuthStore } from '../../lib/stores/authStore';

import SingleDropBox from './SingleDropBox';

import dropboxConfig from '../../config/dropboxConfig';
import type { DropboxesProps } from './types';
import { FileNodeType, PoleshiftPermissions } from '../../lib/types';

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
    const { sampleGroup, sampleLocation } = useMemo(() => {
        if (!sampleGroupId) {
            return { sampleGroup: null, sampleLocation: null };
        }
        const currentSampleGroup = sampleGroups[sampleGroupId];
        const location = getLocationById(currentSampleGroup?.loc_id || null);
        return {
            sampleGroup: currentSampleGroup || null,
            sampleLocation: location,
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
                                sampleLocation={sampleLocation}
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
