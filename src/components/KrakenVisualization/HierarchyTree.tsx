import React, { useMemo } from 'react';
import { Typography, Box, CircularProgress } from '@mui/material';
import {
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    Science as ScienceIcon,
} from '@mui/icons-material';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
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
import {TaxonomyHierarchyNode, TaxonomyNode, useHierarchyTree} from "../../lib/hooks/useHierarchyTree.ts";

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

const convertToFileNodes = (nodes: TaxonomyHierarchyNode[]): TaxonomyFileNode[] => {
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
    nodes: TaxonomyNode[];
}

const HierarchyTree: React.FC<HierarchyTreeProps> = ({ nodes }) => {
    const { hierarchyData, stats, loading, error } = useHierarchyTree(nodes);

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
                    maxHeight: '800px',
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