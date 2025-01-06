// file: QueryBuilder.tsx

import React from 'react';
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Slider,
    Typography,
    Box,
    Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { TaxonomicRank } from '@/lib/powersync/DrizzleSchema';
import { DateTime } from 'luxon';

interface Location {
    id: string;
    label: string;
}

interface QueryBuilderProps {
    selectedRank: TaxonomicRank;
    setSelectedRank: (rank: TaxonomicRank) => void;
    colorShadeRank: TaxonomicRank;
    setColorShadeRank: (rank: TaxonomicRank) => void;
    useLCAShading: boolean;
    setUseLCAShading: (checked: boolean) => void;

    selectedLocations: string[];
    setSelectedLocations: (locs: string[]) => void;
    locations: Location[];

    startDate: string | null;
    setStartDate: (date: string | null) => void;
    endDate: string | null;
    setEndDate: (date: string | null) => void;

    minReadPercentage: number;
    setMinReadPercentage: (val: number) => void;
    minCoverage: number;
    setMinCoverage: (val: number) => void;

    showAsIntraPercent: boolean;
    setShowAsIntraPercent: (checked: boolean) => void;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = (props) => {
    const {
        selectedRank,
        setSelectedRank,
        colorShadeRank,
        setColorShadeRank,
        useLCAShading,
        setUseLCAShading,

        selectedLocations,
        setSelectedLocations,
        locations,

        startDate,
        setStartDate,
        endDate,
        setEndDate,

        minReadPercentage,
        setMinReadPercentage,
        minCoverage,
        setMinCoverage,

        showAsIntraPercent,
        setShowAsIntraPercent,
    } = props;

    return (
        <>
            {/* (A) The rank we are querying */}
            <FormControl fullWidth>
                <InputLabel>Taxonomic Rank (to Display)</InputLabel>
                <Select
                    value={selectedRank}
                    onChange={(e) => setSelectedRank(e.target.value as TaxonomicRank)}
                    label="Taxonomic Rank (to Display)"
                 variant={'outlined'}>
                    {Object.values(TaxonomicRank).map((rank) => (
                        <MenuItem key={rank} value={rank}>
                            {rank}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* (B) The rank we use for color shading */}
            <FormControl fullWidth>
                <InputLabel>Shade by Rank</InputLabel>
                <Select
                    variant={'outlined'}
                    value={colorShadeRank}
                    onChange={(e) => setColorShadeRank(e.target.value as TaxonomicRank)}
                    label="Shade by Rank"
                >
                    {Object.values(TaxonomicRank).map((rank) => (
                        <MenuItem key={rank} value={rank}>
                            {rank}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* (C) Switch for LCA-based shading */}
            <FormControlLabel
                control={
                    <Switch
                        checked={useLCAShading}
                        onChange={(e) => setUseLCAShading(e.target.checked)}
                    />
                }
                label="Use LCA-based Shading Offset"
            />

            {/* (D) Locations */}
            <FormControl fullWidth>
                <InputLabel>Locations</InputLabel>
                <Select
                    multiple
                    variant={'outlined'}
                    value={selectedLocations}
                    onChange={(e) => {
                        // @ts-ignore
                        setSelectedLocations(e.target.value);
                    }}
                    label="Locations"
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                                <Chip
                                    key={value}
                                    label={locations.find((loc) => loc.id === value)?.label || 'Unknown'}
                                    size="small"
                                />
                            ))}
                        </Box>
                    )}
                >
                    {locations.map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                            {location.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* (E) Date Range */}
            <DatePicker
                label="Start Date"
                value={startDate ? DateTime.fromISO(startDate) : null}
                onChange={(newValue) => {
                    if (newValue) {
                        setStartDate(newValue.toISO());
                    } else {
                        setStartDate(null);
                    }
                }}
            />
            <DatePicker
                label="End Date"
                value={endDate ? DateTime.fromISO(endDate) : null}
                onChange={(newValue) => {
                    if (newValue) {
                        setEndDate(newValue.toISO());
                    } else {
                        setEndDate(null);
                    }
                }}
            />

            {/* (F) Minimum Read Percentage */}
            <Box>
                <Typography gutterBottom>
                    Minimum Read Percentage: {minReadPercentage}%
                </Typography>
                <Slider
                    value={minReadPercentage}
                    onChange={(_e, value) => setMinReadPercentage(value as number)}
                    min={0}
                    max={100}
                    step={1}
                />
            </Box>

            {/* (G) Minimum Coverage */}
            <Box>
                <Typography gutterBottom>Minimum Coverage: {minCoverage}</Typography>
                <Slider
                    value={minCoverage}
                    onChange={(_e, value) => setMinCoverage(value as number)}
                    min={0}
                    max={1}
                    step={0.01}
                />
            </Box>

            {/* (H) Show as Intra-location % */}
            <FormControlLabel
                control={
                    <Switch
                        checked={showAsIntraPercent}
                        onChange={(e) => setShowAsIntraPercent(e.target.checked)}
                    />
                }
                label="Show as Intra-location %"
            />
        </>
    );
};
