import { useState, useMemo, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react'; // lucide icons
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

import SummaryCard from './SummaryCard';
import DataTable from './DataTable';
import SearchInput from './SearchInput';
import FilterSelect from './FilterSelect';
import HierarchyTree from './HierarchyTree';
import DistributionChart from './DistributionChart';
import React, { Suspense, lazy } from 'react';
const TaxonomyStarburst = lazy(() => import('./TaxonomyStarburst'));

import type { ProcessedKrakenUniqReport } from 'src/types';

// ShadCN UI
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {supabaseConnector} from "@/lib/powersync/SupabaseConnector.ts";

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
  sampleId: string;
  open: boolean;
  onClose: () => void;
}

// Format helpers
const formatNumber = (num: number | string): string => {
  const value = typeof num === 'string' ? parseInt(num) : num;
  return new Intl.NumberFormat('en-US').format(value);
};
const formatPercentage = (num: number): string => `${num.toFixed(2)}%`;

type SortableKeys = keyof PlotData;

const KrakenVisualization: React.FC<Props> = ({ data, sampleId, open, onClose }) => {
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
  const { toast } = useToast();

  // Transform ProcessedKrakenUniqReport[] into PlotData[]
  const transformedData = useMemo(() => {
    return data.map((entry) => ({
      taxon: entry.tax_name,
      percentage: entry.percentage,
      reads: entry.reads,
      taxReads: entry.tax_reads,
      kmers: entry.kmers,
      dup: entry.duplication,
      cov: entry.coverage,
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
      plotData: entries.map((entry) => ({
        taxon: entry.tax_name,
        percentage: entry.percentage,
        reads: entry.reads,
        taxReads: entry.tax_reads,
        kmers: entry.kmers,
        dup: entry.duplication,
        cov: entry.coverage,
        e_score: entry.e_score,
      })),
    }));
  }, [data]);

  // Compute summary stats
  const summaryStats = useMemo(() => {
    const rootNode = data.find(
        (node) =>
            node.rank === 'Root' ||
            node.tax_name === 'Root' ||
            node.tax_name === 'Life'
    );
    const classifiedReads = rootNode ? rootNode.reads : 0;
    const classificationRate = rootNode ? rootNode.percentage : 0;
    const unclassifiedPercentage = 100 - classificationRate;
    const unclassifiedReads = Math.round(
        (unclassifiedPercentage / 100) * classifiedReads
    );
    const totalReads = classifiedReads + unclassifiedReads;
    const uniqueTaxa = data.filter(
        (node) => node.tax_name !== 'Root' && node.tax_name !== 'Life'
    ).length;

    return {
      totalReads,
      classifiedReads,
      unclassifiedReads,
      classificationRate,
      uniqueTaxa,
    };
  }, [data]);

  // Available ranks for FilterSelect
  const availableRanks = useMemo(() => {
    const ranks = [...new Set(data.map((entry) => entry.rank))];
    return ranks.map((rank) => ({
      value: rank,
      label: rank,
    }));
  }, [data]);

  // Filter data by rank + search
  const filteredData = useMemo(() => {
    let filtered = transformedData;
    if (selectedRank !== 'all') {
      filtered = data
          .filter((entry) => entry.rank === selectedRank)
          .map((entry) => ({
            taxon: entry.tax_name,
            percentage: entry.percentage,
            reads: entry.reads,
            taxReads: entry.tax_reads,
            kmers: entry.kmers,
            dup: entry.duplication,
            cov: entry.coverage,
            e_score: entry.e_score,
          }));
    }
    return filtered.filter((item) =>
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

  // Export (JSON) function
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
        defaultPath: `kraken-analysis-${new Date()
            .toISOString()
            .split('T')[0]}.json`,
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
        toast({
          title: 'Analysis data exported successfully',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description:
            error instanceof Error ? error.message : 'Unknown export error',
        variant: 'destructive',
      });
    }
  }, [data, summaryStats, rankGroups, toast]);

  /**
   * Example: Download a FASTQ file from the raw_fastq_data table for a given sample.
   * Adjust the `.eq('sample_id_fastq', <your_sample_id>)` or `.eq('sample_id', <...>)`
   * depending on which column you use to match the sample.
   */
  const handleDownloadFastq = useCallback(async () => {
    try {
      // 1) Fetch the relevant rows from the `raw_fastq_data` table
      const { data: fastqRows, error } = await supabaseConnector.client
          .from('raw_fastq_data')
          .select('*')
          // Depending on your schema, you might match on `.eq('sample_id', sampleId)` instead:
          .eq('sample_id', sampleId);

      if (error) {
        throw new Error(error.message);
      }
      if (!fastqRows || fastqRows.length === 0) {
        throw new Error(`No FASTQ rows found for sample_id_fastq = ${sampleId}`);
      }

      // 2) Construct FASTQ text
      const fastqRecords = fastqRows.map((row) => {
        // EXACT order you requested (just concatenated in one line):
        // @<parent_read_id> runid=... ch=... start_time=... flow_cell_id=... protocol_group_id=...
        // sample_id=... barcode=... barcode_alias=... parent_read_id=... basecall_model_version_id=...
        const header = [
          `@${row.parent_read_id}`,
          `runid=${row.run_id}`,
          `ch=${row.ch}`,
          `start_time=${row.start_time}`,
          `flow_cell_id=${row.flow_cell_id}`,
          `protocol_group_id=${row.protocol_group_id}`,
          `sample_id=${row.sample_id_fastq}`,
          `barcode=${row.barcode}`,
          `barcode_alias=${row.barcode_alias}`,
          `parent_read_id=${row.parent_read_id}`,
          `basecall_model_version_id=${row.basecall_model_version_id}`,
        ].join(' ');

        // Then the usual FASTQ 4-line block
        return `${header}\n${row.sequence}\n+\n${row.quality}`;
      });

      // 3) Join them with a newline so each read is separated properly
      const fastqContent = fastqRecords.join('\n');

      // 4) Prompt for file save location via Tauri
      const filePath = await save({
        filters: [{ name: 'FASTQ', extensions: ['fastq'] }],
        defaultPath: `sample-${sampleId}.fastq`,
      });

      if (!filePath) {
        // User cancelled
        return;
      }

      // 5) Write out the file
      await writeTextFile(filePath, fastqContent);
      toast({
        title: 'FASTQ downloaded successfully',
        variant: 'default',
      });
    } catch (error) {
      console.error('Download FASTQ failed:', error);
      toast({
        title: 'FASTQ download failed',
        description:
            error instanceof Error ? error.message : 'Unknown FASTQ download error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Tab change
  const handleTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
  };

  // Columns for DataTable
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
        <div className='p-4'>
          <p>No data available</p>
        </div>
    );
  }

  return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className='max-w-full p-0 flex flex-col h-full'>
          {/* Header */}
          <DialogHeader className='bg-background p-3 text-primary'>
            <div className='flex items-center justify-between'>
              <DialogTitle className='text-xl'>
                Taxonomic Classification Analysis
              </DialogTitle>
              <div className='flex items-center gap-2'>
                <Button variant='outline' onClick={handleExport}>
                  <Download className='mr-2 h-4 w-4' />
                  Export Data
                </Button>
                <Button variant='outline' onClick={handleDownloadFastq} className='mr-12'>
                  <Download className='mr-2 h-4 w-4' />
                  Download raw FASTQ
                </Button>
              </div>
            </div>

            {/* Minimal tab bar */}
            <div className='mt-3 flex space-x-4 border-b border-b-border'>
              <Button
                  variant={activeTab === 0 ? 'default' : 'ghost'}
                  onClick={() => handleTabChange(0)}
              >
                Summary
              </Button>
              <Button
                  variant={activeTab === 1 ? 'default' : 'ghost'}
                  onClick={() => handleTabChange(1)}
              >
                Taxonomy Distribution
              </Button>
              <Button
                  variant={activeTab === 2 ? 'default' : 'ghost'}
                  onClick={() => handleTabChange(2)}
              >
                Taxonomy Hierarchy
              </Button>
              <Button
                  variant={activeTab === 3 ? 'default' : 'ghost'}
                  onClick={() => handleTabChange(3)}
              >
                Taxonomy Starburst
              </Button>
            </div>
          </DialogHeader>

          {/* Main body */}
          <div className='p-4 overflow-auto flex-1'>
            {activeTab === 0 && (
                <div>
                  <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                    <SummaryCard
                        title='Total Reads'
                        value={formatNumber(summaryStats.totalReads)}
                    />
                    <SummaryCard
                        title='Classified'
                        value={formatNumber(summaryStats.classifiedReads)}
                        subtitle={formatPercentage(summaryStats.classificationRate)}
                    />
                    <SummaryCard
                        title='Unclassified'
                        value={formatNumber(summaryStats.unclassifiedReads)}
                        subtitle={formatPercentage(
                            100 - summaryStats.classificationRate
                        )}
                    />
                    <SummaryCard
                        title='Unique Taxa'
                        value={formatNumber(summaryStats.uniqueTaxa)}
                    />
                  </div>

                  {rankGroups.length > 0 ? (
                      rankGroups
                          .filter(
                              (rankData) => rankData.rankBase.toUpperCase() !== 'NO RANK'
                          )
                          .map((rankData) => (
                              <DistributionChart
                                  key={rankData.rankBase}
                                  data={rankData.plotData}
                                  title={`${
                                      rankData.rankName.charAt(0).toUpperCase() +
                                      rankData.rankName.slice(1)
                                  } Distribution`}
                              />
                          ))
                  ) : (
                      <p>No data available</p>
                  )}
                </div>
            )}

            {activeTab === 1 && (
                <div className='space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder='Search by taxonomy name...'
                    />
                    <FilterSelect
                        value={selectedRank}
                        onChange={setSelectedRank}
                        options={[
                          { value: 'all', label: 'All Ranks' },
                          ...availableRanks,
                        ]}
                    />
                  </div>
                  <DataTable
                      data={sortedData}
                      columns={taxonomyColumns}
                      onSort={(key, direction) =>
                          setSortConfig({
                            key: key as SortableKeys,
                            direction: direction as SortDirection,
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
                <div className='flex min-h-[calc(100vh-200px)] w-full items-center justify-center p-4'>
                  <div className='w-full max-w-4xl aspect-square'>
                    <Suspense
                        fallback={
                          <div
                              style={{
                                marginBottom: '1rem',
                                alignItems: 'center',
                                justifyContent: 'center',
                                display: 'flex',
                                height: '100%',
                              }}
                          >
                            <Loader2 className='animate-spin' />
                          </div>
                        }
                    >
                      <TaxonomyStarburst
                          data={data.filter(
                              (node) => node.tax_name.toUpperCase() !== 'UNCLASSIFIED'
                          )}
                      />
                    </Suspense>
                  </div>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
  );
};

export default KrakenVisualization;
