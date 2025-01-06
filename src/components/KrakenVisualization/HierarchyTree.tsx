import React, { useMemo } from 'react';
import { Typography, Box } from '@mui/material';
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
import { ProcessedKrakenUniqReport } from "@/lib/types";
import {TaxonomicRank} from "@/lib/powersync/DrizzleSchema.ts";

interface TaxonomyFileNode {
    id: string;
    name: string;
    rank: TaxonomicRank;
    percentage: number;
    reads: number;
    tax_id: number;
    children?: TaxonomyFileNode[];
    type: 'folder' | 'leaf';
}

const formatNumber = (num: number | string): string => {
    const value = typeof num === 'string' ? parseInt(num) : num;
    return new Intl.NumberFormat('en-US').format(value);
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
    data: ProcessedKrakenUniqReport[];
}

const buildHierarchyTree = (data: ProcessedKrakenUniqReport[]): TaxonomyFileNode[] => {
    // Create a map of all nodes
    const nodeMap = new Map<string, TaxonomyFileNode>();

    // First pass: Create all nodes
    data.forEach((item) => {
        nodeMap.set(item.id, {
            id: item.id,
            name: item.tax_name,
            rank: item.rank as TaxonomicRank,
            percentage: item.percentage,
            reads: item.reads,
            tax_id: item.tax_id,
            type: 'leaf', // We'll update this later
            children: [],
        });
    });

    // Second pass: Build relationships
    const roots: TaxonomyFileNode[] = [];
    data.forEach((item) => {
        const node = nodeMap.get(item.id);
        if (!node) return;

        if (item.parent_id && nodeMap.has(item.parent_id)) {
            const parent = nodeMap.get(item.parent_id);
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(node);
                parent.type = 'folder';
            }
        } else {
            // No parent or parent not in our dataset = root node
            roots.push(node);
        }
    });

    return roots;
};

const HierarchyTree: React.FC<HierarchyTreeProps> = ({ data }) => {
    const fileNodes = useMemo(() => {
        return buildHierarchyTree(data);
    }, [data]);

    const getItemId = (item: TaxonomyFileNode) => item.id;
    const getItemLabel = (item: TaxonomyFileNode) => item.name;

    if (!data?.length) {
        return (
            <Typography color="text.secondary" align="center">
                No hierarchy data available
            </Typography>
        );
    }

    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Total nodes: {data.length}
            </Typography>
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