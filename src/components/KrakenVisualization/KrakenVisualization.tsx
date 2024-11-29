// src/components/KrakenVisualization.tsx

import React, { useState, useMemo, useCallback } from 'react';
import {
  AppBar,
  Tabs,
  Tab,
  Toolbar,
  Typography,
  Button,
  Box,
  Grid,
  Dialog,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Download } from '@mui/icons-material';

import SummaryCard from './SummaryCard';
import DataTable from './DataTable';
import SearchInput from './SearchInput';
import FilterSelect from './FilterSelect';
import HierarchyTree from './HierarchyTree';
import DistributionChart from './DistributionChart';

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
  unclassifiedReads: any;
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
  const [sortConfig, setSortConfig] = useState({
    key: 'percentage',
    direction: SortDirection.DESC,
  });

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

    const rootNode = data.hierarchy.find((node) => node.depth === 0);
    const classifiedReads = rootNode?.reads || 0;
    const unclassifiedReads = data.unclassifiedReads || 0;
    const totalReads = classifiedReads + unclassifiedReads;

    const classificationRate =
        totalReads > 0 ? (classifiedReads / totalReads) * 100 : 0;

    const uniqueTaxa =
        data.data?.reduce(
            (sum, rankData) => sum + (rankData.plotData?.length || 0),
            0
        ) || 0;

    return {
      totalReads,
      classifiedReads,
      unclassifiedReads,
      classificationRate,
      uniqueTaxa,
    };
  }, [data]);

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
  }, [data, searchTerm, selectedRank, sortConfig]);

  const handleExport = useCallback(() => {
    if (!data) return;

    const exportData = {
      summary: summaryStats,
      taxonomy: data.data,
      hierarchy: data.hierarchy,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kraken-analysis.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, summaryStats]);

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
          </Tabs>
        </AppBar>

        <Box p={3}>
          {activeTab === 0 && (
              <div>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Total Reads"
                        value={formatNumber(summaryStats.totalReads)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Classified"
                        value={formatNumber(summaryStats.classifiedReads)}
                        subtitle={formatPercentage(summaryStats.classificationRate)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Unclassified"
                        value={formatNumber(summaryStats.unclassifiedReads)}
                        subtitle={formatPercentage(
                            100 - summaryStats.classificationRate
                        )}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Unique Taxa"
                        value={formatNumber(summaryStats.uniqueTaxa)}
                    />
                  </Grid>
                </Grid>

                {data.data?.length > 0 ? (
                    data.data.map((rankData) => (
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
                  <Grid item xs={12} sm={6}>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search by taxonomy name..."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
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
                    data={filteredData}
                    columns={taxonomyColumns}
                    onSort={(key, direction) =>
                        setSortConfig({ key, direction: direction as SortDirection })
                    }
                />
              </div>
          )}

          {activeTab === 2 && data.hierarchy && (
              <div>
                <HierarchyTree nodes={data.hierarchy} />
              </div>
          )}
        </Box>
      </Dialog>
  );
};

export default KrakenVisualization;
