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
console.debug('KrakenVisualization Component');
import SummaryCard from './SummaryCard';
import DataTable from './DataTable';
import SearchInput from './SearchInput';
import FilterSelect from './FilterSelect';
import HierarchyTree from './HierarchyTree';
import DistributionChart from './DistributionChart';
import TaxonomyStarburst from './TaxonomyStarburst';
import { ProcessedKrakenUniqReport } from "../../lib/types";

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

interface PlotData {
  taxon: string;
  percentage: number;
  reads: number;
  taxReads: number;
  kmers: number;
  dup: number;
  cov: number;
  e_score: number;
}

interface Props {
  data: ProcessedKrakenUniqReport[];
  open: boolean;
  onClose: () => void;
}

const formatNumber = (num: number | string): string => {
  const value = typeof num === 'string' ? parseInt(num) : num;
  return new Intl.NumberFormat('en-US').format(value);
};

const formatPercentage = (num: number): string => {
  return `${num.toFixed(2)}%`;
};

type SortableKeys = keyof PlotData;

const KrakenVisualization: React.FC<Props> = ({ data, open, onClose }) => {
  console.log('Kraken Visualization component inner');
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRank, setSelectedRank] = useState('all');
  const [sortConfig, setSortConfig] = useState<{
    key: SortableKeys;
    direction: SortDirection;
  }>({
    key: 'percentage',
    direction: SortDirection.DESC,
  });
  const [exportStatus, setExportStatus] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Transform ProcessedKrakenUniqReport[] into PlotData[]
  const transformedData = useMemo(() => {
    return data.map(entry => ({
      taxon: entry.tax_name,
      percentage: entry.percentage,
      reads: parseInt(entry.reads),
      taxReads: parseInt(entry.tax_reads),
      kmers: parseInt(entry.kmers),
      dup: parseFloat(entry.duplication),
      cov: parseFloat(entry.coverage),
      e_score: entry.e_score,
    }));
  }, [data]);

  // Group data by rank
  const rankGroups = useMemo(() => {
    const groups = data.reduce((acc, entry) => {
      if (!acc[entry.rank]) {
        acc[entry.rank] = [];
      }
      acc[entry.rank].push(entry);
      return acc;
    }, {} as Record<string, ProcessedKrakenUniqReport[]>);

    return Object.entries(groups).map(([rank, entries]) => ({
      rankBase: rank,
      rankName: rank,
      plotData: entries.map(entry => ({
        taxon: entry.tax_name,
        percentage: entry.percentage,
        reads: parseInt(entry.reads),
        taxReads: parseInt(entry.tax_reads),
        kmers: parseInt(entry.kmers),
        dup: parseFloat(entry.duplication),
        cov: parseFloat(entry.coverage),
        e_score: entry.e_score,

      }))
    }));
  }, [data]);

  // Compute summary statistics
  const summaryStats = useMemo(() => {
    const rootNode = data.find(node =>
        node.rank === 'Root' || node.tax_name === 'Root' || node.tax_name === 'Life'
    );

    const totalReads = rootNode ? parseInt(rootNode.reads) : 0;
    const unclassifiedNode = data.find(node => node.tax_name.toUpperCase() === 'UNCLASSIFIED');
    const unclassifiedReads = unclassifiedNode ? parseInt(unclassifiedNode.reads) : 0;
    const classifiedReads = totalReads - unclassifiedReads;
    const classificationRate = totalReads > 0 ? (classifiedReads / totalReads) * 100 : 0;
    const uniqueTaxa = data.filter(node =>
        node.tax_name !== 'Root' &&
        node.tax_name !== 'Life' &&
        node.tax_name.toUpperCase() !== 'UNCLASSIFIED'
    ).length;

    return {
      totalReads,
      classifiedReads,
      unclassifiedReads,
      classificationRate,
      uniqueTaxa,
    };
  }, [data]);

  // Available ranks for filter
  const availableRanks = useMemo(() => {
    const ranks = [...new Set(data.map(entry => entry.rank))];
    return ranks.map(rank => ({
      value: rank,
      label: rank,
    }));
  }, [data]);

  // Filter data by rank + search term
  const filteredData = useMemo(() => {
    let filtered = transformedData;

    if (selectedRank !== 'all') {
      filtered = data
          .filter(entry => entry.rank === selectedRank)
          .map(entry => ({
            taxon: entry.tax_name,
            percentage: entry.percentage,
            reads: parseInt(entry.reads),
            taxReads: parseInt(entry.tax_reads),
            kmers: parseInt(entry.kmers),
            dup: parseFloat(entry.duplication),
            cov: parseFloat(entry.coverage),
            e_score: entry.e_score,
          }));
    }

    return filtered.filter(item =>
        item.taxon.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, transformedData, searchTerm, selectedRank]);

  // Sort the filtered data
  const sortedData = useMemo(() => {
    const { key, direction } = sortConfig;
    return [...filteredData].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === SortDirection.ASC
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
      }

      if (aVal < bVal) return direction === SortDirection.ASC ? -1 : 1;
      if (aVal > bVal) return direction === SortDirection.ASC ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Export handler
  const handleExport = useCallback(async () => {
    try {
      const exportData = {
        summary: summaryStats,
        taxonomy: rankGroups,
        rawData: data,
        metadata: {
          exportDate: new Date().toISOString(),
          totalReads: summaryStats.totalReads,
          classificationRate: summaryStats.classificationRate,
        },
      };

      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `kraken-analysis-${new Date().toISOString().split('T')[0]}.json`,
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
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }
  }, [data, summaryStats, rankGroups]);

  const handleCloseSnackbar = useCallback(() => {
    setExportStatus((prev) => ({ ...prev, open: false }));
  }, []);

  const handleTabChange = useCallback((_: any, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const taxonomyColumns = [
    {
      key: 'taxon' as SortableKeys,
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
    {
      key: 'e_score' as SortableKeys,
      header: 'E-Score',
      sortable: true,
      render: (value: number) => value || 0,
    },
  ];

  if (!data || data.length === 0) {
    return (
        <Box p={3}>
          <Typography>No data available</Typography>
        </Box>
    );
  }

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

                {rankGroups.length > 0 ? (
                    rankGroups
                        .filter((rankData) => rankData.rankBase.toUpperCase() !== 'NO RANK')
                        .map((rankData) => (
                            <DistributionChart
                                key={rankData.rankBase}
                                data={rankData.plotData}
                                title={`${rankData.rankName.charAt(0).toUpperCase()+rankData.rankName.slice(1)} Distribution`}
                            />
                        ))
                ) : (
                    <Typography>No data available</Typography>
                )}
              </div>
          )}

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
                    data={sortedData}
                    columns={taxonomyColumns}
                    onSort={(key, direction) =>
                        setSortConfig({
                          key: key as SortableKeys,
                          direction: direction as SortDirection
                        })
                    }
                />
              </div>
          )}

          {activeTab === 2 && (
              <div>
                <HierarchyTree data={data} />
              </div>
          )}

          {activeTab === 3 && (
              <div className="flex min-h-[calc(100vh-200px)] w-full items-center justify-center p-4">
                <div className="w-full max-w-4xl aspect-square">
                  <TaxonomyStarburst
                      data={data.filter(
                          (node) => node.tax_name.toUpperCase() !== 'UNCLASSIFIED'
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