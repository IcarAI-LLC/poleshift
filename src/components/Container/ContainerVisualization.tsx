// file: ContainerVisualization.tsx
import { useState, useMemo, useRef } from 'react';
import {
    Box,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    Stack,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { asc, eq, and, inArray, gte, lte, isNotNull } from 'drizzle-orm';
import { usePowerSync, useQuery } from '@powersync/react';
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { save as tauriSave } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

import {
    DrizzleSchema,
    processed_kraken_uniq_report,
    sample_group_metadata,
    sample_locations,
    ProximityCategory,
    TaxonomicRank
} from '@/lib/powersync/DrizzleSchema';
import { taxdb_pr2 } from '@/lib/powersync/DrizzleSchema'; // your PR2 table

import { QueryBuilder } from './QueryBuilder';
import { ChartRenderer } from './ChartRenderer';
import {
    climbUntilRank,
    taxonomicDistance,
    buildChartData,
    getProximityGroup
} from './taxonomicUtils';

export const ContainerVisualization = ({
                                           open,
                                           onClose
                                       }: {
    open: boolean;
    onClose: () => void;
}) => {
    // ---------------------------------------
    // 1) Local State
    // ---------------------------------------
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);

    const [selectedRank, setSelectedRank] = useState<TaxonomicRank>(
        TaxonomicRank.Species
    );
    const [minReadPercentage, setMinReadPercentage] = useState(1);
    const [minCoverage, setMinCoverage] = useState(0);
    const [showAsIntraPercent, setShowAsIntraPercent] = useState(false);
    const [colorShadeRank, setColorShadeRank] = useState(TaxonomicRank.Genus);
    const [useLCAShading, setUseLCAShading] = useState(false);

    // Instead of splitByProximity, define a grouping mode
    const [grouping, setGrouping] = useState<
        'location' | 'locationAndProximity' | 'proximity'
    >('location');

    // ---------------------------------------
    // 2) Queries
    // ---------------------------------------
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });

    // (A) sample_locations
    const locationsQuery = drizzleDB
        .select()
        .from(sample_locations)
        .orderBy(asc(sample_locations.label));
    const { data: locations = [] } = useQuery(toCompilableQuery(locationsQuery));

    // (B) taxdb_pr2
    const taxDbQuery = drizzleDB
        .select({
            id: taxdb_pr2.id,
            parent_id: taxdb_pr2.parent_id,
            tax_name: taxdb_pr2.tax_name,
            rank: taxdb_pr2.rank
        })
        .from(taxdb_pr2);
    const { data: taxDbRows = [] } = useQuery(toCompilableQuery(taxDbQuery));

    const taxDbMap = useMemo(() => {
        const map = new Map<
            number,
            { id: number; parent_id: number; rank: TaxonomicRank; tax_name: string }
        >();
        taxDbRows.forEach((r) => {
            map.set(r.id, { ...r });
        });
        return map;
    }, [taxDbRows]);

    // (C) processed_kraken_uniq_report
    const processedDataQuery = useMemo(() => {
        const conditions = [
            eq(processed_kraken_uniq_report.rank, selectedRank),
            eq(sample_group_metadata.excluded, false),
            isNotNull(sample_group_metadata.proximity_category)
        ];

        if (startDate) {
            conditions.push(gte(sample_group_metadata.collection_date, startDate));
        }
        if (endDate) {
            conditions.push(lte(sample_group_metadata.collection_date, endDate));
        }
        if (selectedLocations.length > 0) {
            conditions.push(inArray(sample_group_metadata.loc_id, selectedLocations));
        }
        if (minCoverage > 0) {
            conditions.push(gte(processed_kraken_uniq_report.coverage, minCoverage));
        }
        conditions.push(gte(processed_kraken_uniq_report.percentage, minReadPercentage));

        return drizzleDB
            .select({
                tax_id: processed_kraken_uniq_report.tax_id,
                tax_name: processed_kraken_uniq_report.tax_name,
                rank: processed_kraken_uniq_report.rank,
                reads: processed_kraken_uniq_report.reads,
                coverage: processed_kraken_uniq_report.coverage,
                proximity_category: sample_group_metadata.proximity_category,
                sample_id: processed_kraken_uniq_report.sample_id,
                loc_id: sample_group_metadata.loc_id
            })
            .from(processed_kraken_uniq_report)
            .innerJoin(
                sample_group_metadata,
                eq(processed_kraken_uniq_report.sample_id, sample_group_metadata.id)
            )
            .where(and(...conditions));
    }, [
        drizzleDB,
        selectedRank,
        startDate,
        endDate,
        selectedLocations,
        minCoverage,
        minReadPercentage
    ]);

    const { data: processedData = [] } = useQuery(toCompilableQuery(processedDataQuery));

    // ---------------------------------------
    // 3) Build derived data
    // ---------------------------------------
    // (A) Attach proximity_group, returning each category as is:
    const dataWithProximity = useMemo(() => {
        return processedData
            .map((r) => {
                const group = getProximityGroup(
                    r.proximity_category as ProximityCategory | null
                );
                if (!group) return null;
                return { ...r, proximity_group: group };
            })
            .filter(Boolean);
    }, [processedData]);

    // (B) Grouped data sets for each grouping scenario

    // 1) GROUP BY LOCATION
    const allData = useMemo(() => {
        const merged = dataWithProximity.map((r) => {
            const locLabel =
                locations.find((loc) => loc.id === r?.loc_id)?.label ?? 'Unknown';
            return {
                ...r,
                locLabel
            };
        });
        return buildChartData(merged, showAsIntraPercent, locations, {
            groupByKey: 'locLabel'
        });
    }, [dataWithProximity, showAsIntraPercent, locations]);

    // 2) SPLIT BY PROXIMITY => we have distinct categories: "Close", "Far1", "Far2", etc.
    const closeData = useMemo(() => {
        const recs = dataWithProximity.filter((r) => r!.proximity_group === 'Close');
        const merged = recs.map((r) => {
            const locLabel =
                locations.find((loc) => loc.id === r?.loc_id)?.label ?? 'Unknown';
            return {
                ...r,
                locLabel
            };
        });
        return buildChartData(merged, showAsIntraPercent, locations, {
            groupByKey: 'locLabel'
        });
    }, [dataWithProximity, showAsIntraPercent, locations]);

    // For "Far1", "Far2", etc., we just filter out anything that isn't "Close"
    // We'll call this 'otherProxData' => any category not "Close"
    const farData = useMemo(() => {
        const recs = dataWithProximity.filter((r) => r!.proximity_group !== 'Close');
        const merged = recs.map((r) => {
            const locLabel =
                locations.find((loc) => loc.id === r?.loc_id)?.label ?? 'Unknown';
            return {
                ...r,
                locLabel
            };
        });
        return buildChartData(merged, showAsIntraPercent, locations, {
            groupByKey: 'locLabel'
        });
    }, [dataWithProximity, showAsIntraPercent, locations]);

    // 3) GROUP BY LOCATION + PROXIMITY => "Lake A (Close)", "Lake A (Far1)", "Lake A (Far2)", etc.
    const locationAndProximityData = useMemo(() => {

        const merged = dataWithProximity.map((r) => {
            const locLabel =
                locations.find((loc) => loc.id === r!.loc_id)?.label ?? 'Unknown';
            return {
                ...r!,
                locPlusProx: `${locLabel} (${r!.proximity_group})`
            };
        });
        return buildChartData(merged, showAsIntraPercent, locations, {
            groupByKey: 'locPlusProx'
        });
    }, [dataWithProximity, showAsIntraPercent, locations]);

    // In ContainerVisualization, after building locationAndProximityData:
    locationAndProximityData.sort((a, b) => {
        const [locA] = a.location.split(' ('); // "Lake A"
        const [locB] = b.location.split(' ('); // "Lake B"
        return locA.localeCompare(locB) || a.location.localeCompare(b.location);
    });

    // (C) Build color map for each unique tax_name
    const uniqueTaxaRows = useMemo(() => {
        const m = new Map<string, (typeof dataWithProximity)[number]>();
        dataWithProximity.forEach((r) => {
            if (!m.has(r!.tax_name)) {
                m.set(r!.tax_name, r!);
            }
        });
        return Array.from(m.values());
    }, [dataWithProximity]);

    const taxaColors = useMemo(() => {
        const ancestorToHue = new Map<number, number>();
        let groupIndex = 0;

        function getHueForAncestor(aid: number) {
            if (ancestorToHue.has(aid)) return ancestorToHue.get(aid)!;
            // "golden angle" approach
            const hue = (groupIndex * 137.508) % 360;
            groupIndex++;
            ancestorToHue.set(aid, hue);
            return hue;
        }

        const colorMap: Record<string, string> = {};

        uniqueTaxaRows.forEach((row) => {
            const myId = row?.tax_id || 1;
            const ancId = climbUntilRank(myId, colorShadeRank, taxDbMap) ?? myId;
            const baseHue = getHueForAncestor(ancId);

            let finalLightness = 50;
            if (useLCAShading) {
                const dist = taxonomicDistance(myId, ancId, taxDbMap);
                finalLightness = Math.max(25, 60 - dist * 5);
            }
            colorMap[row?.tax_name || ''] = `hsl(${baseHue}, 70%, ${finalLightness}%)`;
        });

        return colorMap;
    }, [uniqueTaxaRows, colorShadeRank, useLCAShading, taxDbMap]);

    // ---------------------------------------
    // 4) Container ref to hold the chart(s)
    // ---------------------------------------
    const stackedChartsRef = useRef<HTMLDivElement>(null);

    // ---------------------------------------
    // 5) Export Logic: Capture the container
    // ---------------------------------------
    const handleExportAsPNG = async () => {
        if (!stackedChartsRef.current) return;
        const canvas = await html2canvas(stackedChartsRef.current);
        const base64 = canvas.toDataURL('image/png');
        const data = base64.split(',')[1];
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

        const filePath = await tauriSave({
            filters: [{ name: 'Image', extensions: ['png'] }]
        });
        if (!filePath) return;

        await writeFile(filePath, bytes);
        console.log(`Charts saved to: ${filePath}`);
    };

    const handleExportAsPDF = async () => {
        if (!stackedChartsRef.current) return;
        const canvas = await html2canvas(stackedChartsRef.current);
        const base64 = canvas.toDataURL('image/png');

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'pt',
            format: 'a4'
        });
        pdf.addImage(base64, 'PNG', 0, 0, 595, 842);

        const arrayBuffer = pdf.output('arraybuffer');
        const bytes = new Uint8Array(arrayBuffer);

        const filePath = await tauriSave({
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (!filePath) return;

        await writeFile(filePath, bytes);
        console.log(`PDF saved to: ${filePath}`);
    };

    // ---------------------------------------
    // 6) Render
    // ---------------------------------------
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle>Query Builder</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* (A) Query Builder Card */}
                    <Card sx={{ minWidth: 300 }}>
                        <CardContent>
                            <Stack spacing={3}>
                                <QueryBuilder
                                    selectedRank={selectedRank}
                                    setSelectedRank={setSelectedRank}
                                    colorShadeRank={colorShadeRank}
                                    setColorShadeRank={setColorShadeRank}
                                    useLCAShading={useLCAShading}
                                    setUseLCAShading={setUseLCAShading}
                                    selectedLocations={selectedLocations}
                                    setSelectedLocations={setSelectedLocations}
                                    locations={locations}
                                    startDate={startDate}
                                    setStartDate={setStartDate}
                                    endDate={endDate}
                                    setEndDate={setEndDate}
                                    minReadPercentage={minReadPercentage}
                                    setMinReadPercentage={setMinReadPercentage}
                                    minCoverage={minCoverage}
                                    setMinCoverage={setMinCoverage}
                                    showAsIntraPercent={showAsIntraPercent}
                                    setShowAsIntraPercent={setShowAsIntraPercent}
                                />

                                {/* SELECT FOR GROUPING */}
                                <FormControl>
                                    <InputLabel id="grouping-select">Grouping</InputLabel>
                                    <Select
                                        labelId="grouping-select"
                                        label="Grouping"
                                        value={grouping}
                                        onChange={(e) =>
                                            setGrouping(
                                                e.target.value as
                                                    | 'location'
                                                    | 'locationAndProximity'
                                                    | 'proximity'
                                            )
                                        }
                                        variant="outlined"
                                    >
                                        <MenuItem value="location">Group by Location</MenuItem>
                                        <MenuItem value="locationAndProximity">
                                            Group by Location &amp; Proximity
                                        </MenuItem>
                                        <MenuItem value="proximity">Split by Proximity</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* (B) Buttons to export */}
                    <Box display="flex" gap={2}>
                        <Button variant="contained" onClick={handleExportAsPNG}>
                            Export Stacked Charts as PNG
                        </Button>
                        <Button variant="contained" onClick={handleExportAsPDF}>
                            Export Stacked Charts as PDF
                        </Button>
                    </Box>

                    {/* (C) Conditionally render chart(s) based on grouping */}
                    {grouping === 'proximity' && (
                        <Box
                            ref={stackedChartsRef}
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3
                            }}
                        >
                            <ChartRenderer
                                chartData={closeData}
                                chartTitle="Close Samples"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                            <ChartRenderer
                                // This chart now lumps ANY category that's not "Close" => Far1, Far2, etc.
                                chartData={farData}
                                chartTitle="Non-Close Samples"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                        </Box>
                    )}

                    {grouping === 'location' && (
                        <Box ref={stackedChartsRef} sx={{ display: 'flex', gap: 3 }}>
                            <ChartRenderer
                                chartData={allData}
                                chartTitle="All Samples (Close + Far...)"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                        </Box>
                    )}

                    {grouping === 'locationAndProximity' && (
                        <Box ref={stackedChartsRef} sx={{ display: 'flex', gap: 3 }}>
                            <ChartRenderer
                                chartData={locationAndProximityData}
                                chartTitle="Location & Proximity"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                        </Box>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ContainerVisualization;
