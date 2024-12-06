// src/components/HierarchyTree.tsx

import React, { useMemo } from 'react';
import { Typography, Box } from '@mui/material';
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

interface TaxonomyNode {
    name: string;
    taxId: number;
    rank: string;
    percentage: number;
    reads: number;
    taxReads: number;
    depth: number;
    kmers: number;
    dup: number;
    cov: number;
}

interface TreeNode extends TaxonomyNode {
    children: TreeNode[];
}

// We'll convert our `TreeNode` structure into a simpler format for the RichTreeView.
// This mimics the `FileNode` structure in the example, where `type` can be "folder" if it has children or "leaf" otherwise.
interface TaxonomyFileNode {
    id: string;
    name: string;
    rank: string;
    percentage: number;
    reads: number;
    children?: TaxonomyFileNode[];
    type: 'folder' | 'leaf';
}

// Build the tree data from a flat list of nodes as before, but now we return TreeNode[].
const buildTree = (nodes: TaxonomyNode[]): TreeNode[] => {
    if (!nodes?.length) return [];

    const rootNodes: TreeNode[] = [];
    const stack: TreeNode[] = [];

    nodes.forEach((node) => {
        const treeNode: TreeNode = {
            ...node,
            children: [],
        };

        // Adjust the stack based on the depth
        while (stack.length > 0 && stack[stack.length - 1].depth >= treeNode.depth) {
            stack.pop();
        }

        if (stack.length === 0) {
            // No parent, this is a root node
            rootNodes.push(treeNode);
        } else {
            // Add as a child to the last node in the stack
            stack[stack.length - 1].children.push(treeNode);
        }

        // Push current node onto the stack
        stack.push(treeNode);
    });

    return rootNodes;
};

let nodeCounter = 0;
const convertToFileNodes = (tree: TreeNode[]): TaxonomyFileNode[] => {
    return tree.map((node) => {
        nodeCounter += 1;
        return {
            id: `node-${nodeCounter}`, // a guaranteed unique ID
            name: node.name,
            rank: node.rank,
            percentage: node.percentage,
            reads: node.reads,
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

    // Access the item's data
    const item = publicAPI.getItem(itemId) as TaxonomyFileNode;
    const isFolder = item.type === 'folder';

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
                        {/* Additional taxonomy info */}
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
    const treeData = useMemo(() => buildTree(nodes), [nodes]);
    const fileNodes = useMemo(() => convertToFileNodes(treeData), [treeData]);

    const getItemId = (item: TaxonomyFileNode) => item.id;
    const getItemLabel = (item: TaxonomyFileNode) => item.name;

    if (!nodes?.length) {
        return (
            <Typography color="text.secondary" align="center">
                No hierarchy data available
            </Typography>
        );
    }

    return (
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
    );
};

export default HierarchyTree;
