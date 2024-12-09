import React, { useMemo, useEffect, useState } from 'react';
import { Typography, Box, CircularProgress } from '@mui/material';
import {
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    Science as ScienceIcon,
} from '@mui/icons-material';
import {
    RichTreeView,
} from '@mui/x-tree-view/RichTreeView';
import { useTreeItem2, UseTreeItem2Parameters } from '@mui/x-tree-view/useTreeItem2';
import {
    TreeItem2Content,
    TreeItem2IconContainer,
    TreeItem2GroupTransition,
    TreeItem2Label,
    TreeItem2Root,
} from '@mui/x-tree-view/TreeItem2';
import { TreeItem2Icon } from '@mui/x-tree-view/TreeItem2Icon';
import { TreeItem2Provider } from '@mui/x-tree-view/TreeItem2Provider';
import { styled } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';

interface _TaxonomyNodeHierarchyTree {
    name: string;
    tax_id: number;
    rank: string;
    percentage: number;
    reads: number;
    depth: number;
    children?: _TaxonomyNodeHierarchyTree[];
}

interface TaxonomyFileNode {
    id: string;
    name: string;
    rank: string;
    percentage: number;
    reads: number;
    tax_id?: number;
    children?: TaxonomyFileNode[];
    type: 'folder' | 'leaf';
}

let nodeCounter = 0;
// Update the convertToFileNodes function to handle the new field names
const convertToFileNodes = (nodes: _TaxonomyNodeHierarchyTree[]): TaxonomyFileNode[] => {
    return nodes.map((node) => {
        nodeCounter += 1;
        return {
            id: `node-${nodeCounter}`,
            name: node.name,
            rank: node.rank,
            percentage: node.percentage,
            reads: node.reads,
            tax_id: node.tax_id,
            type: node.children && node.children.length > 0 ? 'folder' : 'leaf',
            children: node.children && node.children.length > 0
                ? convertToFileNodes(node.children)
                : undefined,
        };
    });
};
// Update the validation function
const validateAndTransformNodes = (nodes: any[]): _TaxonomyNodeHierarchyTree[] => {
    return nodes.map(node => ({
        name: node.name,
        tax_id: node.taxId || 0,
        rank: node.rank,
        percentage: node.percentage,
        reads: node.reads,
        depth: node.depth,
        children: [] // Initialize empty children array
    }));
};

const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
};

const formatPercentage = (num: number): string => {
    return num.toFixed(2).toString() + "%";
};

const CustomTreeItemContent = styled(TreeItem2Content)(({ theme }) => ({
    padding: theme.spacing(0.5, 1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

interface CustomTaxonomyTreeItemProps
    extends Omit<UseTreeItem2Parameters, 'rootRef'>,
        Omit<React.HTMLAttributes<HTMLLIElement>, 'onFocus'> {}

const CustomTaxonomyTreeItem = React.forwardRef(function CustomTaxonomyTreeItem(
    props: CustomTaxonomyTreeItemProps,
    ref: React.Ref<HTMLLIElement>,
) {
    const { id, itemId, label, disabled, children, ...other } = props;
    const { getRootProps, getContentProps, getIconContainerProps, getLabelProps, getGroupTransitionProps, status, publicAPI } =
        useTreeItem2({ id, itemId, children, label, disabled, rootRef: ref });

    const item = publicAPI.getItem(itemId) as TaxonomyFileNode;

    return (
        <TreeItem2Provider itemId={itemId}>
            <TreeItem2Root {...getRootProps(other)}>
                <CustomTreeItemContent {...getContentProps()}>
                    <TreeItem2IconContainer {...getIconContainerProps()}>
                        <TreeItem2Icon status={status} />
                    </TreeItem2IconContainer>
                    <Box sx={{ flexGrow: 1, display: 'flex', gap: 1, alignItems: 'center', fontSize: '0.9em' }}>
                        {item.type === 'folder' && (status.expanded ? <FolderOpenIcon /> : <FolderIcon />)}
                        {item.type !== 'folder' && <ScienceIcon sx={{ color: 'cyan' }} />}
                        <TreeItem2Label {...getLabelProps()} />
                        <Typography component="span" color="text.secondary" sx={{ fontSize: '0.8em' }}>
                            ({item.rank})
                        </Typography>
                        <Typography component="span" color="text.secondary" sx={{ fontSize: '0.8em' }}>
                            {formatPercentage(item.percentage)}
                        </Typography>
                        <Typography component="span" color="text.secondary" sx={{ fontSize: '0.8em' }}>
                            {formatNumber(item.reads)} reads
                        </Typography>
                    </Box>
                </CustomTreeItemContent>
                {children && <TreeItem2GroupTransition {...getGroupTransitionProps()} />}
            </TreeItem2Root>
        </TreeItem2Provider>
    );
});

interface HierarchyTreeProps {
    nodes: _TaxonomyNodeHierarchyTree[];
}

const HierarchyTree: React.FC<HierarchyTreeProps> = ({ nodes }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hierarchyData, setHierarchyData] = useState<_TaxonomyNodeHierarchyTree[]>([]);
    const [stats, setStats] = useState<Record<string, number>>({});

    useEffect(() => {
        const buildHierarchy = async () => {
            if (!nodes?.length) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Transform the incoming nodes to match Rust structure
                const transformedNodes = validateAndTransformNodes(nodes);

                // Debug log to check the structure
                console.log('Transformed nodes:', JSON.stringify(transformedNodes, null, 2));

                // Build the hierarchy using Rust
                const hierarchy = await invoke<_TaxonomyNodeHierarchyTree[]>('build_taxonomy_hierarchy', {
                    nodes: transformedNodes
                });

                // Validate the hierarchy
                const isValid = await invoke<boolean>('validate_taxonomy_hierarchy', {
                    nodes: hierarchy
                });

                if (!isValid) {
                    throw new Error('Invalid hierarchy structure detected');
                }

                // Get hierarchy statistics
                const hierarchyStats = await invoke<Record<string, number>>('get_hierarchy_stats', {
                    nodes: hierarchy
                });

                setHierarchyData(hierarchy);
                setStats(hierarchyStats);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to build hierarchy';
                console.error('Error building hierarchy:', err);
                console.error('Original nodes:', nodes);
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        buildHierarchy();
    }, [nodes]);

    const fileNodes = useMemo(() => {
        nodeCounter = 0; // Reset counter before converting
        return convertToFileNodes(hierarchyData);
    }, [hierarchyData]);

    const getItemId = (item: TaxonomyFileNode) => item.id;
    const getItemLabel = (item: TaxonomyFileNode) => item.name;

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    if (error) {
        return (
            <Typography color="error" align="center">
                Error: {error}
            </Typography>
        );
    }

    if (!hierarchyData?.length) {
        return (
            <Typography color="text.secondary" align="center">
                No hierarchy data available
            </Typography>
        );
    }

    return (
        <Box>
            {stats.total_nodes && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Total nodes: {stats.total_nodes}
                </Typography>
            )}
            <Box
                sx={{
                    maxHeight: '600px',
                    overflowY: 'auto',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    p: 1,
                    fontSize: '0.9em',
                }}
            >
                <RichTreeView<TaxonomyFileNode>
                    items={fileNodes}
                    slots={{ item: CustomTaxonomyTreeItem }}
                    getItemId={getItemId}
                    getItemLabel={getItemLabel}
                    aria-label="taxonomy hierarchy navigator"
                />
            </Box>
        </Box>
    );
};

export default HierarchyTree;