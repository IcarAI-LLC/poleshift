// src/utils/dataProcessingUtils.ts



interface KrakenReportEntry {
    depth: number;
    percentage: number;
    cladeReads: number;
    taxonReads: number;
    rankCode: string;
    rankLevel: number;
    rankBase: string;
    taxId: number;
    name: string;
}

interface RankData {
    rankBase: string;
    rankName: string;
    plotData: Array<{
        taxon: string;
        percentage: number;
        cladeReads: number;
        taxonReads: number;
        depth: number;
        rankLevel: number;
    }>;
}

interface TaxonomyNode {
    name: string;
    taxId: number;
    rankCode: string;
    rankLevel: number;
    percentage: number;
    cladeReads: number;
    taxonReads: number;
    depth: number;
    children: TaxonomyNode[];
}

interface ProcessedKrakenData {
    type: 'report';
    data: RankData[];
    hierarchy: KrakenReportEntry[];
}

const RANK_NAMES: Record<string, string> = {
    R: 'Root',
    D: 'Domain',
    K: 'Kingdom',
    P: 'Phylum',
    C: 'Class',
    O: 'Order',
    F: 'Family',
    G: 'Genus',
    S: 'Species',
};



export const processKrakenDataForModal = (
    dataItem: any,
): ProcessedKrakenData => {
    try {
        if (!dataItem) {
            throw new Error('No data provided');
        }

        const data = dataItem.data || dataItem;

        // Handle string input (raw Kraken report)
        if (typeof data === 'string') {
            return processKrakenReport(data);
        }

        // Handle array input (array of KrakenReportEntry)
        if (Array.isArray(data)) {
            return processKrakenEntries(data);
        }

        console.error('Unexpected data format:', {
            type: typeof data,
            isArray: Array.isArray(data),
            sample:
                typeof data === 'object'
                    ? JSON.stringify(data).slice(0, 100)
                    : String(data).slice(0, 100),
            keys: data && typeof data === 'object' ? Object.keys(data) : [],
        });

        throw new Error(`Invalid data format - received ${typeof data}`);
    } catch (error) {
        console.error('Error processing Kraken data:', error);
        throw error;
    }
};

// Modify the processKrakenEntries function
const processKrakenEntries = (
    entries: KrakenReportEntry[],
): ProcessedKrakenData => {
    // Build the taxonomy tree using the iterative method
    // const hierarchyTree = buildTaxonomyTreeIterative(entries);

    // Generate rank data for plotting
    const rankGroups = entries.reduce(
        (acc, item) => {
            const { rankBase } = item;
            if (!acc[rankBase]) {
                acc[rankBase] = [];
            }
            acc[rankBase].push(item);
            return acc;
        },
        {} as Record<string, KrakenReportEntry[]>,
    );

    const plotDataPerRank: RankData[] = Object.entries(rankGroups)
        .map(([rankBase, items]) => {
            const rankName = RANK_NAMES[rankBase] || rankBase;

            const plotData = items
                .sort((a, b) => b.percentage - a.percentage)
                .map((item) => ({
                    taxon: item.name,
                    percentage: item.percentage,
                    cladeReads: item.cladeReads,
                    taxonReads: item.taxonReads,
                    depth: item.depth,
                    rankLevel: item.rankLevel,
                }));

            return {
                rankBase,
                rankName,
                plotData,
            };
        })
        // Sort ranks in biological order
        .sort((a, b) => {
            const rankOrder = Object.keys(RANK_NAMES);
            return rankOrder.indexOf(a.rankBase) - rankOrder.indexOf(b.rankBase);
        });

    return {
        hierarchy: [],
        type: 'report',
        data: plotDataPerRank
    };
};


// @ts-ignore
const buildTaxonomyTreeIterative = (
    entries: KrakenReportEntry[],
): TaxonomyNode[] => {
    const rootNodes: TaxonomyNode[] = [];
    const stack: TaxonomyNode[] = [];

    for (const entry of entries) {
        const node: TaxonomyNode = {
            name: entry.name,
            taxId: entry.taxId,
            rankCode: entry.rankCode,
            rankLevel: entry.rankLevel,
            percentage: entry.percentage,
            cladeReads: entry.cladeReads,
            taxonReads: entry.taxonReads,
            depth: entry.depth,
            children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
            stack.pop();
        }

        if (stack.length === 0) {
            rootNodes.push(node);
        } else {
            stack[stack.length - 1].children.push(node);
        }

        stack.push(node);
    }

    return rootNodes;
};

const processKrakenReport = (reportContent: string): ProcessedKrakenData => {
    // Parse report lines into structured data
    const lines = reportContent.split('\n').filter((line) => line.trim());

    const hierarchicalData: KrakenReportEntry[] = lines
        .map((line) => {
            const match = line.match(
                /^([\t\s]*)([\d.]+)\t(\d+)\t(\d+)\t([A-Z][\d]*)\t(\d+)\t(.+)$/
            );

            if (!match) return null;

            const [
                ,
                indent,
                percentage,
                cladeReads,
                taxonReads,
                rankStr,
                taxId,
                name,
            ] = match;

            // Calculate depth based on tabs and spaces
            const depth = indent.replace(/ {2}/g, '\t').length;

            return {
                depth: depth,
                percentage: parseFloat(percentage),
                cladeReads: parseInt(cladeReads, 10),
                taxonReads: parseInt(taxonReads, 10),
                rankCode: rankStr,
                rankLevel: parseInt(rankStr.match(/\d+/)?.[0] || '0', 10),
                rankBase: rankStr.charAt(0),
                taxId: parseInt(taxId, 10),
                name: name.trim(),
            };
        })
        .filter((item): item is KrakenReportEntry => item !== null);
    // Group entries by rank
    const rankGroups = hierarchicalData.reduce(
        (acc, item) => {
            const { rankBase } = item;
            if (!acc[rankBase]) {
                acc[rankBase] = [];
            }
            acc[rankBase].push(item);
            return acc;
        },
        {} as Record<string, KrakenReportEntry[]>,
    );

    // Create plot data for each rank
    const plotDataPerRank: RankData[] = Object.entries(rankGroups)
        .map(([rankBase, items]) => {
            const rankName = RANK_NAMES[rankBase] || rankBase;

            const plotData = items
                .sort((a, b) => b.percentage - a.percentage)
                .map((item) => ({
                    taxon: item.name,
                    percentage: item.percentage,
                    cladeReads: item.cladeReads,
                    taxonReads: item.taxonReads,
                    depth: item.depth,
                    rankLevel: item.rankLevel,
                }));

            return {
                rankBase,
                rankName,
                plotData,
            };
        })
        // Sort ranks in biological order
        .sort((a, b) => {
            const rankOrder = Object.keys(RANK_NAMES);
            return rankOrder.indexOf(a.rankBase) - rankOrder.indexOf(b.rankBase);
        });

    return {
        type: 'report',
        data: plotDataPerRank,
        hierarchy: hierarchicalData,
    };
};

export const calculateKrakenSummaryStats = (data: ProcessedKrakenData) => {
    const rootNode = data.hierarchy.find((node) => node.rankBase === 'R');
    const totalReads = rootNode?.cladeReads || 0;

    // Calculate maximum classified reads across all ranks
    const classifiedReads = data.data.reduce((max, rankData) => {
        const rankTotal = rankData.plotData.reduce(
            (sum, item) => sum + item.cladeReads,
            0,
        );
        return Math.max(max, rankTotal);
    }, 0);

    return {
        totalReads,
        classifiedReads,
        unclassifiedReads: totalReads - classifiedReads,
        classificationRate: (classifiedReads / totalReads) * 100,
        uniqueTaxa: data.data.reduce(
            (sum, rankData) => sum + rankData.plotData.length,
            0,
        ),
    };
};

export const searchKrakenData = (
    data: ProcessedKrakenData,
    searchTerm: string,
    selectedRank: string = 'all',
) => {
    const termLower = searchTerm.toLowerCase();

    if (selectedRank === 'all') {
        return data.data.flatMap((rankData) =>
            rankData.plotData.filter((item) =>
                item.taxon.toLowerCase().includes(termLower),
            ),
        );
    }

    const rankData = data.data.find((d) => d.rankBase === selectedRank);
    if (!rankData) return [];

    return rankData.plotData.filter((item) =>
        item.taxon.toLowerCase().includes(termLower),
    );
};

export {
    processKrakenReport,
    type ProcessedKrakenData,
    type KrakenReportEntry,
    type RankData,
};
