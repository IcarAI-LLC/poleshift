import { useState, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Slider,
    Typography,
    Chip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { eq, and, inArray, asc, gte, lte } from 'drizzle-orm';
import { usePowerSync, useQuery } from '@powersync/react';
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import { DrizzleSchema, processed_kraken_uniq_report, TaxonomicRank, sample_group_metadata, sample_locations } from '@/lib/powersync/DrizzleSchema';
import {DateTime} from "luxon";

//@ts-ignore
const ContainerVisualization = ({ open, onClose }) => {
    const [selectedLocations, setSelectedLocations] = useState([]);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [selectedRank, setSelectedRank] = useState(TaxonomicRank.Species);
    const [minReadPercentage, setMinReadPercentage] = useState(1);

    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });

    const locationsQuery = drizzleDB
        .select()
        .from(sample_locations)
        .orderBy(asc(sample_locations.label));

    const { data: locations = [] } = useQuery(toCompilableQuery(locationsQuery));

    const taxonomicDataQuery = useMemo(() => {
        const conditions = [eq(processed_kraken_uniq_report.rank, selectedRank)];

        if (startDate) {
            conditions.push(gte(sample_group_metadata.collection_date, startDate));
        }
        if (endDate) {
            conditions.push(lte(sample_group_metadata.collection_date, endDate));
        }
        if (selectedLocations.length > 0) {
            conditions.push(inArray(sample_group_metadata.loc_id, selectedLocations));
        }

        return drizzleDB
            .select({
                tax_name: processed_kraken_uniq_report.tax_name,
                tax_id: processed_kraken_uniq_report.tax_id,
                percentage: processed_kraken_uniq_report.percentage,
                rank: processed_kraken_uniq_report.rank,
                sample_id: processed_kraken_uniq_report.sample_id,
                loc_id: sample_group_metadata.loc_id,
            })
            .from(processed_kraken_uniq_report)
            .innerJoin(
                sample_group_metadata,
                eq(processed_kraken_uniq_report.sample_id, sample_group_metadata.id)
            )
            .where(and(...conditions));
    }, [drizzleDB, selectedRank, startDate, endDate, selectedLocations]);

    const { data: taxonomicData = [] } = useQuery(toCompilableQuery(taxonomicDataQuery));

    const chartData = useMemo(() => {
        // Define the types for our grouped data
        interface TaxaData {
            [taxonName: string]: number;
        }

        interface GroupedData {
            [location: string]: TaxaData;
        }

        const groupedData: GroupedData = {};
        const taxaSet = new Set<string>();

        taxonomicData.forEach(record => {
            if (record.percentage >= minReadPercentage) {
                const location = locations.find(loc => loc.id === record.loc_id)?.label || 'Unknown';
                if (!groupedData[location]) {
                    groupedData[location] = {};
                }
                if (!groupedData[location][record.tax_name]) {
                    groupedData[location][record.tax_name] = 0;
                }
                groupedData[location][record.tax_name] += record.percentage;
                taxaSet.add(record.tax_name);
            }
        });

        return Object.entries(groupedData).map(([location, taxa]) => ({
            location,
            ...taxa
        }));
    }, [taxonomicData, locations, minReadPercentage]);

    const taxaColors = useMemo(() => {
        interface ColorMap {
            [taxon: string]: string;
        }

        const uniqueTaxa = [...new Set(taxonomicData.map(d => d.tax_name))];
        return uniqueTaxa.reduce<ColorMap>((acc, taxa, index) => {
            const hue = (index * 137.508) % 360;
            acc[taxa] = `hsl(${hue}, 70%, 50%)`;
            return acc;
        }, {});
    }, [taxonomicData]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>Query Builder</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                    <Card sx={{ minWidth: 300 }}>
                        <CardContent>
                            <Stack spacing={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Taxonomic Rank</InputLabel>
                                    <Select
                                        value={selectedRank}
                                        onChange={(e) => setSelectedRank(e.target.value as TaxonomicRank)}
                                        label="Taxonomic Rank"
                                    >
                                        {Object.values(TaxonomicRank).map((rank) => (
                                            <MenuItem key={rank} value={rank}>
                                                {rank}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth>
                                    <InputLabel>Locations</InputLabel>
                                    <Select
                                        multiple={true}
                                        value={selectedLocations}
                                        // @ts-ignore
                                        onChange={(e) => setSelectedLocations(e.target.value)}
                                        label="Locations"
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip
                                                        key={value}
                                                        label={locations.find(loc => loc.id === value)?.label}
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

                                <DatePicker
                                    label="Start Date"
                                    // Suppose the DatePicker is configured to return a Luxon DateTime
                                    // (see your MUI X docs on using different date-libraries).
                                    // If dayjs is your default, you can still wrap it with Luxon.
                                    value={startDate ? DateTime.fromISO(startDate) : null}
                                    onChange={(newValue) => {
                                        // newValue will be a Luxon DateTime (or null)
                                        if (newValue) {
                                            setStartDate(newValue.toISO()); // e.g. "2023-08-24T00:00:00.000Z"
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
                                            // Convert Luxon DateTime to an ISO string
                                            setEndDate(newValue.toISO());
                                        } else {
                                            setEndDate(null);
                                        }
                                    }}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            variant: 'outlined'
                                        }
                                    }}
                                />

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
                            </Stack>
                        </CardContent>
                    </Card>

                    <Box sx={{ flex: 1, height: 600 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} stackOffset="expand">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="location" />
                                <YAxis tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`} />
                                <Tooltip
                                    formatter={(value: number) => `${value.toFixed(2)}%`}
                                    labelFormatter={(label: any) => `Location: ${label}`}
                                />
                                <Legend />
                                {Object.keys(taxaColors).map((taxa) => (
                                    <Bar
                                        key={taxa}
                                        dataKey={taxa}
                                        stackId="taxa"
                                        fill={taxaColors[taxa]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ContainerVisualization;