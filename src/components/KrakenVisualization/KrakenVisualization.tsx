import React, { useState, useMemo, useCallback } from 'react';
import {
  AppBar,
  Tabs,
  Tab,
  Toolbar,
  Typography,
  Button,
  Box,
  Dialog,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import CloseIcon from '@mui/icons-material/Close';
import { Download } from '@mui/icons-material';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

import SummaryCard from './SummaryCard';
import DataTable from './DataTable';
import SearchInput from './SearchInput';
import FilterSelect from './FilterSelect';
import HierarchyTree from './HierarchyTree';
import DistributionChart from './DistributionChart';
import TaxonomyStarburst from './TaxonomyStarburst';

// --------------------------------------------------
// 1. Define enum for the sort direction
// --------------------------------------------------
enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

// --------------------------------------------------
// 2. Define interfaces for your data
// --------------------------------------------------

// This represents a single "plotData" row
interface PlotData {
  taxon: string;
  percentage: number;
  reads: number;
  taxReads: number;
  kmers: number;
  dup: number;
  cov: number;
  depth: number;
}

interface RankData {
  rankBase: string;
  rankName: string;
  plotData: PlotData[];
}

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

interface KrakenData {
  type: 'report';
  data: RankData[];
  hierarchy: KrakenReportEntry[];
  unclassifiedReads: number;
}

interface Props {
  data?: KrakenData;
  open: boolean;
  onClose: () => void;
}

// --------------------------------------------------
// 3. Utility functions for formatting
// --------------------------------------------------
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

const formatPercentage = (num: number): string => {
  return `${num.toFixed(2)}%`;
};

// --------------------------------------------------
// 4. Define a type for the valid sort keys
//    (they must match the fields in PlotData)
// --------------------------------------------------
type SortableKeys = keyof PlotData;
// i.e., 'taxon' | 'percentage' | 'reads' | 'taxReads' | 'kmers' | 'dup' | 'cov' | 'depth'

const KrakenVisualization: React.FC<Props> = ({ data, open, onClose }) => {
  // Which tab is active
  const [activeTab, setActiveTab] = useState(0);

  // For searching within the taxonomy table
  const [searchTerm, setSearchTerm] = useState('');

  // Which rank is selected in the filter (or "all")
  const [selectedRank, setSelectedRank] = useState('all');

  // --------------------------------------------------
  // 5. Our sort config uses the union SortableKeys
  // --------------------------------------------------
  const [sortConfig, setSortConfig] = useState<{
    key: SortableKeys;
    direction: SortDirection;
  }>({
    key: 'percentage',
    direction: SortDirection.DESC,
  });

  // Export status
  const [exportStatus, setExportStatus] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // --------------------------------------------------
  // 6. Compute summary statistics
  // --------------------------------------------------
  const summaryStats = useMemo(() => {
    if (!data?.hierarchy) {
      return {
        totalReads: 0,
        classifiedReads: 0,
        unclassifiedReads: 0,
        classificationRate: 0,
        uniqueTaxa: 0,
      };
    }

    // Find the root node (named "Life" or "Root")
    const rootNode = data.hierarchy.find(
        (node) => node.name === 'Life' || node.name === 'Root'
    );

    // Classified reads
    const classifiedReads = rootNode?.reads ?? 0;

    // Unclassified reads come directly from the top-level data
    const unclassifiedReads = data.unclassifiedReads;

    // Total reads + classification rate
    const totalReads = classifiedReads + unclassifiedReads;
    const classificationRate =
        totalReads > 0 ? (classifiedReads / totalReads) * 100 : 0;

    // Unique taxa excludes the root itself
    const uniqueTaxa = data.hierarchy.filter(
        (node) => node.name !== 'Life' && node.name !== 'Root'
    ).length;

    return {
      totalReads,
      classifiedReads,
      unclassifiedReads,
      classificationRate,
      uniqueTaxa,
    };
  }, [data]);

  // --------------------------------------------------
  // 7. Build the list of available ranks for the filter
  // --------------------------------------------------
  const availableRanks = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((rankData) => ({
      value: rankData.rankBase,
      label: rankData.rankName,
    }));
  }, [data]);

  // --------------------------------------------------
  // 8. Filter data by rank + search term
  // --------------------------------------------------
  const filteredData = useMemo(() => {
    if (!data?.data) return [];

    const rankData =
        selectedRank === 'all'
            ? data.data.flatMap((d) => d.plotData || [])
            : data.data.find((d) => d.rankBase === selectedRank)?.plotData || [];

    return rankData.filter((item) =>
        item.taxon.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm, selectedRank]);

  // --------------------------------------------------
  // 9. Sort the filtered data
  // --------------------------------------------------
  const sortedData = useMemo(() => {
    const { key, direction } = sortConfig;
    return [...filteredData].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      // If sorting by "taxon" (string), do string comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === SortDirection.ASC
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
      }

      // Otherwise assume numeric comparison
      if (aVal < bVal) return direction === SortDirection.ASC ? -1 : 1;
      if (aVal > bVal) return direction === SortDirection.ASC ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // --------------------------------------------------
  // 10. Export handler
  // --------------------------------------------------
  const handleExport = useCallback(async () => {
    try {
      if (!data) {
        throw new Error('No data available for export');
      }

      const exportData = {
        summary: summaryStats,
        taxonomy: data.data,
        hierarchy: data.hierarchy,
        unclassifiedReads: data.unclassifiedReads,
        metadata: {
          exportDate: new Date().toISOString(),
          totalReads: summaryStats.totalReads,
          classificationRate: summaryStats.classificationRate,
        },
      };

      const filePath = await save({
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
        defaultPath: `kraken-analysis-${new Date()
            .toISOString()
            .split('T')[0]}.json`,
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
        setExportStatus({
          open: true,
          message: 'Analysis data exported successfully',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus({
        open: true,
        message: `Export failed: ${
            error instanceof Error ? error.message : 'Unknown error'
        }`,
        severity: 'error',
      });
    }
  }, [data, summaryStats]);

  // --------------------------------------------------
  // 11. Close snackbar
  // --------------------------------------------------
  const handleCloseSnackbar = useCallback(() => {
    setExportStatus((prev) => ({ ...prev, open: false }));
  }, []);

  // --------------------------------------------------
  // 12. Tab change handler
  // --------------------------------------------------
  const handleTabChange = useCallback((_: any, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  // --------------------------------------------------
  // 13. DataTable columns definition
  // --------------------------------------------------
  const taxonomyColumns = [
    {
      key: 'taxon' as SortableKeys,  // explicitly cast to SortableKeys
      header: 'Name',
      sortable: true,
    },
    {
      key: 'reads' as SortableKeys,
      header: 'Reads',
      sortable: true,
      render: (value: number) => formatNumber(value || 0),
    },
    {
      key: 'taxReads' as SortableKeys,
      header: 'Tax Reads',
      sortable: true,
      render: (value: number) => formatNumber(value || 0),
    },
    {
      key: 'kmers' as SortableKeys,
      header: 'Kmers',
      sortable: true,
      render: (value: number) => formatNumber(value || 0),
    },
    {
      key: 'dup' as SortableKeys,
      header: 'Duplication',
      sortable: true,
      render: (value: number) => formatNumber(value || 0),
    },
    {
      key: 'cov' as SortableKeys,
      header: 'Coverage',
      sortable: true,
      render: (value: number) => formatPercentage(value || 0),
    },
    {
      key: 'percentage' as SortableKeys,
      header: 'Percentage',
      sortable: true,
      render: (value: number) => formatPercentage(value || 0),
    },
  ];

  // --------------------------------------------------
  // 14. Fallback if data is missing
  // --------------------------------------------------
  if (!data) {
    return (
        <Box p={3}>
          <Typography>No data available</Typography>
        </Box>
    );
  }

  // --------------------------------------------------
  // 15. Main component rendering
  // --------------------------------------------------
  return (
      <Dialog open={open} onClose={onClose} fullScreen>
        <AppBar position="static" color="primary" sx={{ position: 'relative' }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Taxonomic Classification Analysis
            </Typography>
            <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExport}
                disabled={!data}
                sx={{ mr: 2, color: '#fff', borderColor: '#fff' }}
            >
              Export Data
            </Button>
            <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
          <Tabs
              value={activeTab}
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="secondary"
              variant="scrollable"
          >
            <Tab label="Summary" />
            <Tab label="Taxonomy Distribution" />
            <Tab label="Taxonomy Hierarchy" />
            <Tab label="Taxonomy Starburst" />
          </Tabs>
        </AppBar>

        <Box p={3}>
          {/* --- Tab 0: Summary --- */}
          {activeTab === 0 && (
              <div>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <SummaryCard
                        title="Total Reads"
                        value={formatNumber(summaryStats.totalReads)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <SummaryCard
                        title="Classified"
                        value={formatNumber(summaryStats.classifiedReads)}
                        subtitle={formatPercentage(summaryStats.classificationRate)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <SummaryCard
                        title="Unclassified"
                        value={formatNumber(summaryStats.unclassifiedReads)}
                        subtitle={formatPercentage(100 - summaryStats.classificationRate)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <SummaryCard
                        title="Unique Taxa"
                        value={formatNumber(summaryStats.uniqueTaxa)}
                    />
                  </Grid>
                </Grid>

                {data.data?.length > 0 ? (
                    data.data
                        .filter((rankData) => rankData.rankBase.toUpperCase() !== 'NO RANK')
                        .map((rankData) => (
                            <DistributionChart
                                key={rankData.rankBase}
                                data={rankData.plotData || []}
                                title={`${rankData.rankName} Distribution`}
                            />
                        ))
                ) : (
                    <Typography>No data available</Typography>
                )}
              </div>
          )}

          {/* --- Tab 1: Taxonomy Distribution --- */}
          {activeTab === 1 && (
              <div>
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search by taxonomy name..."
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FilterSelect
                        value={selectedRank}
                        onChange={setSelectedRank}
                        options={[
                          { value: 'all', label: 'All Ranks' },
                          ...availableRanks,
                        ]}
                        label="Rank"
                    />
                  </Grid>
                </Grid>
                <DataTable
                    data={sortedData} // <-- Use sorted data
                    columns={taxonomyColumns}
                    onSort={(key, direction) =>
                        setSortConfig({ key: key as keyof PlotData, direction: direction as SortDirection })
                    }
                />
              </div>
          )}

          {/* --- Tab 2: Taxonomy Hierarchy --- */}
          {activeTab === 2 && data.hierarchy && (
              <div>
                <HierarchyTree
                    nodes={data.hierarchy.filter(
                        (node) => node.rank.toUpperCase() !== 'NO RANK'
                    )}
                />
              </div>
          )}

          {/* --- Tab 3: Taxonomy Starburst --- */}
          {activeTab === 3 && data.hierarchy && (
              <div className="flex min-h-[calc(100vh-200px)] w-full items-center justify-center p-4">
                <div className="w-full max-w-4xl aspect-square">
                  <TaxonomyStarburst
                      nodes={data.hierarchy.filter(
                          (node) => node.name.toUpperCase() !== 'UNCLASSIFIED'
                      )}
                  />
                </div>
              </div>
          )}
        </Box>

        <Snackbar
            open={exportStatus.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
              onClose={handleCloseSnackbar}
              severity={exportStatus.severity}
              variant="filled"
          >
            {exportStatus.message}
          </Alert>
        </Snackbar>
      </Dialog>
  );
};

export default KrakenVisualization;
