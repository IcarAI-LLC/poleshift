import { useState, useMemo, useRef } from "react";
import { asc, eq, and, inArray, gte, lte, isNotNull } from "drizzle-orm";
import { usePowerSync, useQuery } from "@powersync/react";
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { save as tauriSave } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

// ShadCN UI Components
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Local imports
import {
    DrizzleSchema,
    processed_kraken_uniq_report,
    sample_group_metadata,
    sample_locations,
    TaxonomicRank,
    taxdb_pr2,
    ProximityCategory,
} from "@/lib/powersync/DrizzleSchema";
import { QueryBuilder } from "./QueryBuilder";
import { ChartRenderer } from "./ChartRenderer";
import {
    climbUntilRank,
    taxonomicDistance,
    buildChartData,
    getProximityGroup,
} from "./taxonomicUtils";
import { ProcessedKrakenUniqReport } from "src/types";
import {DateTime} from "luxon";

interface ContainerVisualizationProps {
    open: boolean;
    onClose: () => void;
}

interface DataWithProximity extends ProcessedKrakenUniqReport {
    proximity_group: string;
    loc_id: string;
    proximity_category: ProximityCategory;
    // NEW: we’ll store the raw date we fetch:
    collection_date: string;
}

export default function ContainerVisualization({ open, onClose }: ContainerVisualizationProps) {
    // ---------------------------------------
    // 1) Local State
    // ---------------------------------------
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);

    const [selectedRank, setSelectedRank] = useState<TaxonomicRank>(TaxonomicRank.Species);
    const [minReadPercentage, setMinReadPercentage] = useState(1);
    const [minCoverage, setMinCoverage] = useState(0);
    const [showAsIntraPercent, setShowAsIntraPercent] = useState(false);
    const [colorShadeRank, setColorShadeRank] = useState(TaxonomicRank.Genus);

    // EXTEND grouping STATE WITH A NEW OPTION
    const [grouping, setGrouping] = useState<
        "location" | "locationAndProximity" | "locationProximityAndDate" | "proximity"
    >("location");

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
            rank: taxdb_pr2.rank,
        })
        .from(taxdb_pr2);
    const { data: taxDbRows = [] } = useQuery(toCompilableQuery(taxDbQuery));

    // Build a map for quick lookups in your taxonomic utility functions
    const taxDbMap = useMemo(() => {
        const map = new Map<
            number,
            { id: number; parent_id: number; rank: TaxonomicRank; tax_name: string }
        >();
        taxDbRows.forEach((row) => {
            const numericId = Number(row.id) || 0;
            const numericParent = Number(row.parent_id) || 0;
            map.set(numericId, {
                id: numericId,
                parent_id: numericParent,
                tax_name: row.tax_name,
                rank: row.rank,
            });
        });
        return map;
    }, [taxDbRows]);

    // (C) processed_kraken_uniq_report
    const processedDataQuery = useMemo(() => {
        console.log(startDate);
        // Build a dynamic array of conditions
        const conditions = [
            // Only data that matches the rank we selected
            eq(processed_kraken_uniq_report.rank, selectedRank),
            // Excluded = false
            eq(sample_group_metadata.excluded, false),
            // Must have some proximity_category set
            isNotNull(sample_group_metadata.proximity_category),
        ];

        // Date filtering
        if (startDate) {
            conditions.push(gte(sample_group_metadata.collection_date, startDate));
        }
        if (endDate) {
            conditions.push(lte(sample_group_metadata.collection_date, endDate));
        }

        // Location filtering
        if (selectedLocations.length > 0) {
            conditions.push(inArray(sample_group_metadata.loc_id, selectedLocations));
        }

        // Coverage filtering
        if (minCoverage > 0) {
            conditions.push(gte(processed_kraken_uniq_report.coverage, minCoverage));
        }

        // Read-percentage filtering
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
                loc_id: sample_group_metadata.loc_id,
                // FETCH THE COLLECTION DATE
                collection_date: sample_group_metadata.collection_date,
            })
            .from(processed_kraken_uniq_report)
            .innerJoin(
                sample_group_metadata,
                eq(processed_kraken_uniq_report.sample_id, sample_group_metadata.id)
            )
            .where(and(...conditions)).orderBy(asc(sample_group_metadata.collection_date));
    }, [
        drizzleDB,
        selectedRank,
        startDate,
        endDate,
        selectedLocations,
        minCoverage,
        minReadPercentage,
    ]);

    // Fetch the data from Drizzle/PowerSync
    const { data: processedData = [] } = useQuery(toCompilableQuery(processedDataQuery));

    // ---------------------------------------
    // 3) Build derived data
    // ---------------------------------------
    // (A) Attach a proximity_group based on the proximity_category
    const dataWithProximity = useMemo<DataWithProximity[]>(() => {
        return processedData
            .map((row) => {
                const group = getProximityGroup(row.proximity_category);
                if (!group) return null;
                return {
                    ...row,
                    proximity_group: group,
                };
            })
            .filter((row): row is DataWithProximity => row !== null);
    }, [processedData]);

    // (B) Prepare chart data
    // 1) GROUP BY LOCATION
    const allData = useMemo(() => {
        const merged = dataWithProximity.map((r) => {
            const locLabel = locations.find((loc) => loc.id === r?.loc_id)?.label ?? "Unknown";
            return { ...r, locLabel };
        });
        return buildChartData(merged, showAsIntraPercent, locations, { groupByKey: "locLabel" });
    }, [dataWithProximity, showAsIntraPercent, locations]);

    // 2) GROUP BY "Close" vs. everything else
    const closeData = useMemo(() => {
        const recs = dataWithProximity.filter((r) => r?.proximity_group === "Close");
        const merged = recs.map((r) => {
            const locLabel = locations.find((loc) => loc.id === r?.loc_id)?.label ?? "Unknown";
            return { ...r, locLabel };
        });
        return buildChartData(merged, showAsIntraPercent, locations, { groupByKey: "locLabel" });
    }, [dataWithProximity, showAsIntraPercent, locations]);

    const farData = useMemo(() => {
        const recs = dataWithProximity.filter((r) => r?.proximity_group !== "Close");
        const merged = recs.map((r) => {
            const locLabel = locations.find((loc) => loc.id === r?.loc_id)?.label ?? "Unknown";
            return { ...r, locLabel };
        });
        return buildChartData(merged, showAsIntraPercent, locations, { groupByKey: "locLabel" });
    }, [dataWithProximity, showAsIntraPercent, locations]);

    // 3) GROUP BY LOCATION + PROXIMITY
    const locationAndProximityData = useMemo(() => {
        const merged = dataWithProximity.map((r) => {
            const locLabel = locations.find((loc) => loc.id === r?.loc_id)?.label ?? "Unknown";
            return { ...r, locPlusProx: `${locLabel} (${r?.proximity_group})` };
        });
        const result = buildChartData(merged, showAsIntraPercent, locations, {
            groupByKey: "locPlusProx",
        });
        // Sort purely for better labeling
        result.sort((a, b) => {
            const [locA] = a.location.split(" (");
            const [locB] = b.location.split(" (");
            return locA.localeCompare(locB) || a.location.localeCompare(b.location);
        });
        return result;
    }, [dataWithProximity, showAsIntraPercent, locations]);

    const locationProximityAndDateData = useMemo(() => {
        const merged = dataWithProximity.map((r) => {
            const locLabel = locations.find((loc) => loc.id === r.loc_id)?.label ?? "Unknown";
            const proxGroup = r.proximity_group ?? "UnknownProx";

            // If r.collection_date is valid ISO (e.g. 2023-11-14T12:34:56Z),
            // parse with Luxon, or fallback to a default date if missing.
            const dateStr = r.collection_date ?? "1970-01-01T00:00:00Z";
            const dt = DateTime.fromISO(dateStr);

            // For the label, we’ll still display just YYYY-MM-DD
            const dateOnly = dt.isValid ? dt.toFormat("yyyy-LL-dd") : "NoDate";

            return {
                ...r,
                locProxDate: `${locLabel} (${proxGroup}) - ${dateOnly}`,
                rawLocLabel: locLabel,
                rawProximity: proxGroup,
                numericDate: dt.isValid ? dt.toMillis() : 0, // store as a numeric timestamp
            };
        });

        // Build chart data *after* sorting
        const result = buildChartData(merged, showAsIntraPercent, locations, {
            groupByKey: "locProxDate",
        });
        return result;
    }, [dataWithProximity, showAsIntraPercent, locations]);

    // (C) Color map for taxa (always LCA shading)
    const uniqueTaxaRows = useMemo(() => {
        const m = new Map<string, (typeof dataWithProximity)[number]>();
        dataWithProximity.forEach((r) => {
            if (!m.has(r.tax_name)) {
                m.set(r.tax_name, r);
            }
        });
        return Array.from(m.values());
    }, [dataWithProximity]);

    const taxaColors = useMemo(() => {
        const ancestorToHue = new Map<number, number>();
        let groupIndex = 0;

        function getHueForAncestor(aid: number) {
            if (ancestorToHue.has(aid)) return ancestorToHue.get(aid)!;
            // "Golden angle" color spacing
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

            // Always do LCA shading
            const dist = taxonomicDistance(myId, ancId, taxDbMap);
            const finalLightness = Math.max(25, 60 - dist * 5);

            colorMap[row?.tax_name] = `hsl(${baseHue}, 70%, ${finalLightness}%)`;
        });

        return colorMap;
    }, [uniqueTaxaRows, colorShadeRank, taxDbMap]);

    // ---------------------------------------
    // 4) Container ref for charts
    // ---------------------------------------
    const stackedChartsRef = useRef<HTMLDivElement>(null);

    // ---------------------------------------
    // 5) Export logic
    // ---------------------------------------
    const handleExportAsPNG = async () => {
        if (!stackedChartsRef.current) return;
        const canvas = await html2canvas(stackedChartsRef.current);
        const base64 = canvas.toDataURL("image/png");
        const data = base64.split(",")[1];
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

        const filePath = await tauriSave({
            filters: [{ name: "Image", extensions: ["png"] }],
        });
        if (!filePath) return;

        await writeFile(filePath, bytes);
        console.log(`Charts saved to: ${filePath}`);
    };

    const handleExportAsPDF = async () => {
        if (!stackedChartsRef.current) return;
        const canvas = await html2canvas(stackedChartsRef.current);
        const base64 = canvas.toDataURL("image/png");

        const pdf = new jsPDF({
            orientation: "p",
            unit: "pt",
            format: "a4",
        });
        pdf.addImage(base64, "PNG", 0, 0, 595, 842);

        const arrayBuffer = pdf.output("arraybuffer");
        const bytes = new Uint8Array(arrayBuffer);

        const filePath = await tauriSave({
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!filePath) return;

        await writeFile(filePath, bytes);
        console.log(`PDF saved to: ${filePath}`);
    };

    // ---------------------------------------
    // 6) Render
    // ---------------------------------------
    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className={"max-w-full flex flex-col h-full overflow-y-scroll"}>
                <DialogTitle>
                    <DialogTitle>Query Builder</DialogTitle>
                </DialogTitle>

                {/* (A) Query Builder Card */}
                <Card className="m-2">
                    <CardContent className="space-y-4 p-2">
                        <QueryBuilder
                            selectedRank={selectedRank}
                            setSelectedRank={setSelectedRank}
                            colorShadeRank={colorShadeRank}
                            setColorShadeRank={setColorShadeRank}
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

                        {/* SELECT FOR GROUPING (using ShadCN <Select>) */}
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="grouping">Grouping</Label>
                            <Select
                                value={grouping}
                                onValueChange={(val) =>
                                    setGrouping(
                                        val as
                                            | "location"
                                            | "locationAndProximity"
                                            | "proximity"
                                            | "locationProximityAndDate"
                                    )
                                }
                            >
                                <SelectTrigger id="grouping" className="w-[240px]">
                                    <SelectValue placeholder="Select grouping..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="location">Group by Location</SelectItem>
                                    <SelectItem value="locationAndProximity">
                                        Group by Location &amp; Proximity
                                    </SelectItem>
                                    <SelectItem value="proximity">Split by Proximity</SelectItem>
                                    {/* NEW grouping option */}
                                    <SelectItem value="locationProximityAndDate">
                                        Group by Location + Proximity + Date
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* (B) Export Buttons */}
                <div className="flex items-center gap-2 px-2">
                    <Button onClick={handleExportAsPNG}>Export Stacked Charts as PNG</Button>
                    <Button onClick={handleExportAsPDF}>Export Stacked Charts as PDF</Button>
                </div>

                {/* (C) Conditionally render chart(s) based on grouping */}
                <div className="p-2">
                    {grouping === "proximity" && (
                        <div ref={stackedChartsRef} className="flex flex-col gap-6">
                            <ChartRenderer
                                chartData={closeData}
                                chartTitle="Close Samples"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                            <ChartRenderer
                                chartData={farData}
                                chartTitle="Non-Close Samples"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                        </div>
                    )}

                    {grouping === "location" && (
                        <div ref={stackedChartsRef} className="flex gap-6">
                            <ChartRenderer
                                chartData={allData}
                                chartTitle="All Samples (Close + Far...)"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                        </div>
                    )}

                    {grouping === "locationAndProximity" && (
                        <div ref={stackedChartsRef} className="flex gap-6">
                            <ChartRenderer
                                chartData={locationAndProximityData}
                                chartTitle="Location & Proximity"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                        </div>
                    )}

                    {/* NEW: Grouping by location + proximity + date */}
                    {grouping === "locationProximityAndDate" && (
                        <div ref={stackedChartsRef} className="flex gap-6">
                            <ChartRenderer
                                chartData={locationProximityAndDateData}
                                chartTitle="Location + Proximity + Date"
                                showAsIntraPercent={showAsIntraPercent}
                                taxaColors={taxaColors}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
