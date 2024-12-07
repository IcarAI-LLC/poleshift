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

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

interface KrakenData {
  type: 'report';
  data: Array<{
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
  }>;
  hierarchy: KrakenReportEntry[];
  unclassifiedReads: number;
}

interface KrakenReportEntry {
  depth: number;
  percentage: number;
  reads: number;
  taxReads: number;
  kmers: number;
  dup: number;
  cov: number;
  taxId: number;
  rank: string;
  name: string;
}

interface Props {
  data?: KrakenData;
  open: boolean;
  onClose: () => void;
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

const formatPercentage = (num: number): string => {
  return `${num.toFixed(2)}%`;
};

const KrakenVisualization: React.FC<Props> = ({ data, open, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRank, setSelectedRank] = useState('all');
  const [_, setSortConfig] = useState({
    key: 'percentage',
    direction: SortDirection.DESC,
  });
  const [exportStatus, setExportStatus] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({open: false, message: '', severity: 'success'});

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

    // Find the root node (either named "Life" or "Root")
    const rootNode = data.hierarchy.find(node =>
        node.name === "Life" || node.name === "Root"
    );

    // Calculate classified reads from the root node if found
    const classifiedReads = rootNode?.reads ?? 0;

    // Use unclassifiedReads directly from the data
    const unclassifiedReads = data.unclassifiedReads;

    // Calculate total reads and classification rate
    const totalReads = classifiedReads + unclassifiedReads;
    const classificationRate = totalReads > 0 ? (classifiedReads / totalReads) * 100 : 0;

    // Count unique taxa (all nodes except root)
    const uniqueTaxa = data.hierarchy
        .filter(node => node.name !== "Life" && node.name !== "Root")
        .length;

    return {
      totalReads,
      classifiedReads,
      unclassifiedReads,
      classificationRate,
      uniqueTaxa,
    };
  }, [data]);

  // Rest of the component remains the same
  const availableRanks = useMemo(() => {
    if (!data?.data) return [];

    return data.data.map((rankData) => ({
      value: rankData.rankBase,
      label: rankData.rankName,
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data?.data) return [];

    const rankData =
        selectedRank === 'all'
            ? data.data.flatMap((d) => d.plotData || [])
            : data.data.find((d) => d.rankBase === selectedRank)?.plotData || [];

    return rankData.filter((item) =>
        item.taxon?.toLowerCase().includes(searchTerm.toLowerCase() || '')
    );
  }, [data, searchTerm, selectedRank]);

  // Export handler updated to include unclassified reads directly
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
          classificationRate: summaryStats.classificationRate
        }
      };

      const filePath = await save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        defaultPath: `kraken-analysis-${new Date().toISOString().split('T')[0]}.json`
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
        setExportStatus({
          open: true,
          message: 'Analysis data exported successfully',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus({
        open: true,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }, [data, summaryStats]);

  const handleCloseSnackbar = useCallback(() => {
    setExportStatus(prev => ({...prev, open: false}));
  }, []);

  const handleTabChange = useCallback((_: any, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const taxonomyColumns = [
    {
      key: 'taxon',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'reads',
      header: 'Reads',
      sortable: true,
      render: (value: number) => formatNumber(value || 0),
    },
    {
      key: 'taxReads',
      header: 'Tax Reads',
      sortable: true,
      render: (value: number) => formatNumber(value || 0),
    },
    {
      key: 'percentage',
      header: 'Percentage',
      sortable: true,
      render: (value: number) => formatPercentage(value || 0),
    },
  ];

  if (!data) {
    return (
        <Box p={3}>
          <Typography>No data available</Typography>
        </Box>
    );
  }

  return (
      <Dialog open={open} onClose={onClose} fullScreen>
        <AppBar position="static" color="primary" sx={{position: 'relative'}}>
          <Toolbar>
            <Typography variant="h6" sx={{flexGrow: 1}}>
              Taxonomic Classification Analysis
            </Typography>
            <Button
                variant="outlined"
                startIcon={<Download/>}
                onClick={handleExport}
                disabled={!data}
                sx={{mr: 2, color: '#fff', borderColor: '#fff'}}
            >
              Export Data
            </Button>
            <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
              <CloseIcon/>
            </IconButton>
          </Toolbar>
          <Tabs
              value={activeTab}
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="secondary"
              variant="scrollable"
          >
            <Tab label="Summary"/>
            <Tab label="Taxonomy Distribution"/>
            <Tab label="Taxonomy Hierarchy"/>
            <Tab label="Taxonomy Starburst"/>
          </Tabs>
        </AppBar>

        <Box p={3}>
          {activeTab === 0 && (
              <div>
                <Grid container spacing={2}>
                  <Grid size={{xs: 12, md: 3}}>
                    <SummaryCard
                        title="Total Reads"
                        value={formatNumber(summaryStats.totalReads)}
                    />
                  </Grid>
                  <Grid size={{xs: 12, md: 3}}>
                    <SummaryCard
                        title="Classified"
                        value={formatNumber(summaryStats.classifiedReads)}
                        subtitle={formatPercentage(summaryStats.classificationRate)}
                    />
                  </Grid>
                  <Grid size={{xs: 12, md: 3}}>
                    <SummaryCard
                        title="Unclassified"
                        value={formatNumber(summaryStats.unclassifiedReads)}
                        subtitle={formatPercentage(100 - summaryStats.classificationRate)}
                    />
                  </Grid>
                  <Grid size={{xs: 12, md: 3}}>
                    <SummaryCard
                        title="Unique Taxa"
                        value={formatNumber(summaryStats.uniqueTaxa)}
                    />
                  </Grid>
                </Grid>

                {data.data?.length > 0 ? (
                    data.data
                        .filter(rankData => rankData.rankBase.toUpperCase() !== 'NO RANK')
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

          {activeTab === 1 && (
              <div>
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid size={{xs: 12, sm: 6}}>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search by taxonomy name..."
                    />
                  </Grid>
                  <Grid size={{xs: 12, sm: 6}}>
                    <FilterSelect
                        value={selectedRank}
                        onChange={setSelectedRank}
                        options={[
                          {value: 'all', label: 'All Ranks'},
                          ...availableRanks,
                        ]}
                        label="Rank"
                    />
                  </Grid>
                </Grid>
                <DataTable
                    data={filteredData}
                    columns={taxonomyColumns}
                    onSort={(key, direction) =>
                        setSortConfig({key, direction: direction as SortDirection})
                    }
                />
              </div>
          )}

          {activeTab === 2 && data.hierarchy && (
              <div>
                <HierarchyTree
                    nodes={data.hierarchy.filter(node => node.rank.toUpperCase() !== 'NO RANK')}
                />
              </div>
          )}
          {activeTab === 3 && data.hierarchy && (
              <div>
                <TaxonomyStarburst
                    nodes={data.hierarchy.filter(node => node.name.toUpperCase() !== 'UNCLASSIFIED')}
                />
              </div>
          )}
        </Box>

        <Snackbar
            open={exportStatus.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
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