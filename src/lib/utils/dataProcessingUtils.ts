// src/utils/dataProcessingUtils.ts

interface KrakenReportEntry {
    depth: number;
    percentage: number;
    reads: number;
    taxReads: number;
    kmers: number;
    dup: number;
    cov: number;
    tax_id: number;
    rank: string;
    name: string;
}

interface RankData {
    rankBase: string;
    rankName: string;
    plotData: Array<{
        taxon: string;
        percentage: number;
        reads: number;
        taxReads: number;
        kmers: number;
        dup: number;
        cov: number;
        depth: number;
    }>;
}
interface ProcessedKrakenData {
    type: 'report';
    data: RankData[];
    hierarchy: KrakenReportEntry[];
    unclassifiedReads?: number;
}

const RANK_NAMES: Record<string, string> = {
    'NO RANK': 'No Rank',
    'ROOT' : 'Root',
    'DOMAIN': 'Domain',
    'SUPERGROUP': 'Supergroup',
    'DIVISION': 'Division',
    'SUBDIVISION': 'Subdivision',
    'CLASS': 'Class',
    'ORDER': 'Order',
    'FAMILY': 'Family',
    'GENUS': 'Genus',
    'SPECIES': 'Species',
    'ASSEMBLY': 'Assembly',
    'SEQUENCE': 'Sequence',
};

export const processKrakenDataForModal = (
    dataItem: any,
): ProcessedKrakenData => {
    try {
        if (!dataItem) {
            throw new Error('No data provided');
        }

        const data = dataItem;

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

const processKrakenEntries = (
    entries: KrakenReportEntry[],
): ProcessedKrakenData => {
    // Filter out any entries with rank 'RANK'
    const filteredEntries = entries.filter(
        (item) => item.rank.toUpperCase() !== 'RANK',
    );

    // Group entries by rank
    const rankGroups = filteredEntries.reduce((acc, item) => {
        const rankBase = item.rank.toUpperCase();
        if (!acc[rankBase]) {
            acc[rankBase] = [];
        }
        acc[rankBase].push(item);
        return acc;
    }, {} as Record<string, KrakenReportEntry[]>);

    // Create plot data for each rank
    const plotDataPerRank: RankData[] = Object.entries(rankGroups)
        .map(([rankBase, items]) => {
            const rankName = RANK_NAMES[rankBase] || rankBase;

            const plotData = items
                .sort((a, b) => b.percentage - a.percentage)
                .map((item) => ({
                    taxon: item.name,
                    percentage: item.percentage,
                    reads: item.reads,
                    taxReads: item.taxReads,
                    kmers: item.kmers,
                    dup: item.dup,
                    cov: item.cov,
                    depth: item.depth,
                }));

            return {
                rankBase,
                rankName,
                plotData,
            };
        })
        // Optionally sort ranks in a specific order
        .sort((a, b) => {
            const rankOrder = Object.keys(RANK_NAMES);
            return rankOrder.indexOf(a.rankBase) - rankOrder.indexOf(b.rankBase);
        });

    return {
        hierarchy: filteredEntries,
        type: 'report',
        data: plotDataPerRank,
    };
};

const processKrakenReport = (reportContent: string): ProcessedKrakenData => {
    // Split the content into lines and filter out empty lines
    const lines = reportContent.split('\n').filter((line) => line.trim());

    // Skip the header line
    const dataLines = lines.slice(1);

    // Extract unclassified reads from the first line if present
    let unclassifiedReads = 0;
    const unclassifiedLineMatch = dataLines[0]?.match(
        /^(\d+\.\d+)\t(\d+)\t(\d+)\t.*unclassified$/i,
    );
    if (unclassifiedLineMatch) {
        const [, , readsStr] = unclassifiedLineMatch;
        unclassifiedReads = parseInt(readsStr, 10);

        // Remove unclassified line from dataLines
        dataLines.shift();
    }

    const hierarchicalData: KrakenReportEntry[] = dataLines
        .map((line) => {
            // Split the line by tabs
            const columns = line.split('\t');
            if (columns.length < 9) return null;

            const [
                percentageStr,
                readsStr,
                taxReadsStr,
                kmersStr,
                dupStr,
                covStr,
                tax_idStr,
                rankStr,
                taxNameWithIndent,
            ] = columns;

            // Calculate depth based on leading spaces in taxName
            const matchIndent = taxNameWithIndent.match(/^(\s*)(\S.*)$/);
            if (!matchIndent) return null;

            const indentSpaces = matchIndent[1];
            const taxName = matchIndent[2];

            const depth = indentSpaces.length / 2; // Assuming each level is indented by 2 spaces

            // Filter out any record that has a rank of "RANK"
            const rank = rankStr.trim().toUpperCase();
            if (rank === 'RANK') {
                return null;
            }

            return {
                depth,
                percentage: parseFloat(percentageStr),
                reads: parseInt(readsStr, 10),
                taxReads: parseInt(taxReadsStr, 10),
                kmers: parseInt(kmersStr, 10),
                dup: parseFloat(dupStr),
                cov: parseFloat(covStr),
                tax_id: parseInt(tax_idStr, 10),
                rank,
                name: taxName.trim(),
            };
        })
        .filter((item): item is KrakenReportEntry => item !== null);

    // Group entries by rank
    const rankGroups = hierarchicalData.reduce((acc, item) => {
        const rankBase = item.rank.toUpperCase();
        if (!acc[rankBase]) {
            acc[rankBase] = [];
        }
        acc[rankBase].push(item);
        return acc;
    }, {} as Record<string, KrakenReportEntry[]>);

    // Create plot data for each rank
    const plotDataPerRank: RankData[] = Object.entries(rankGroups)
        .map(([rankBase, items]) => {
            const rankName = RANK_NAMES[rankBase] || rankBase;

            const plotData = items
                .sort((a, b) => b.percentage - a.percentage)
                .map((item) => ({
                    taxon: item.name,
                    percentage: item.percentage,
                    reads: item.reads,
                    taxReads: item.taxReads,
                    kmers: item.kmers,
                    dup: item.dup,
                    cov: item.cov,
                    depth: item.depth,
                }));

            return {
                rankBase,
                rankName,
                plotData,
            };
        })
        // Optionally sort ranks in a specific order
        .sort((a, b) => {
            const rankOrder = Object.keys(RANK_NAMES);
            return rankOrder.indexOf(a.rankBase) - rankOrder.indexOf(b.rankBase);
        });

    return {
        type: 'report',
        data: plotDataPerRank,
        hierarchy: hierarchicalData,
        unclassifiedReads,
    };
};

export const calculateKrakenSummaryStats = (data: ProcessedKrakenData) => {
    const classifiedReads = data.hierarchy.reduce(
        (sum, node) => sum + node.reads,
        0,
    );
    const unclassifiedReads = data.unclassifiedReads || 0;
    const totalReads = classifiedReads + unclassifiedReads;

    const classificationRate =
        totalReads > 0 ? (classifiedReads / totalReads) * 100 : 0;

    const uniqueTaxa = data.data.reduce(
        (sum, rankData) => sum + rankData.plotData.length,
        0,
    );

    return {
        totalReads,
        classifiedReads,
        unclassifiedReads,
        classificationRate,
        uniqueTaxa,
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
    processKrakenEntries,
    type ProcessedKrakenData,
    type KrakenReportEntry,
    type RankData,
};
