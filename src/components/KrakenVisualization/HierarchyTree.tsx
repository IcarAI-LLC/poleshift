// src/components/HierarchyTree.tsx

import React, { useMemo } from 'react';
import { Typography, Box } from '@mui/material';

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

interface HierarchyTreeProps {
    nodes: TaxonomyNode[];
}

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


const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
};

const formatPercentage = (num: number): string => {
    return num.toFixed(2).toString() + "%" ;
};

const NodeContent: React.FC<{ node: TreeNode }> = ({ node }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography component="span" sx={{ fontWeight: 'bold' }}>
            {node.name}
        </Typography>
        <Typography
            component="span"
            color="text.secondary"
            sx={{ fontSize: '0.9em' }}
        >
            ({node.rank})
        </Typography>
        <Typography
            component="span"
            color="text.secondary"
            sx={{ fontSize: '0.9em' }}
        >
            {formatPercentage(node.percentage)}
        </Typography>
        <Typography
            component="span"
            color="text.secondary"
            sx={{ fontSize: '0.9em' }}
        >
            {formatNumber(node.reads)} reads
        </Typography>
    </Box>
);

const TreeBranch: React.FC<{ node: TreeNode; indent: number }> = ({
                                                                      node,
                                                                      indent,
                                                                  }) => (
    <Box sx={{ ml: indent * 3, my: 1 }}>
        <NodeContent node={node} />
        {node.children.length > 0 && (
            <Box sx={{ borderLeft: '1px solid #ccc', pl: 2 }}>
                {node.children.map((child) => (
                    <TreeBranch key={child.taxId} node={child} indent={indent + 1} />
                ))}
            </Box>
        )}
    </Box>
);

const HierarchyTree: React.FC<HierarchyTreeProps> = ({ nodes }) => {
    const treeData = useMemo(() => buildTree(nodes), [nodes]);

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
                p: 2,
            }}
        >
            {treeData.map((node) => (
                <TreeBranch key={node.taxId} node={node} indent={0} />
            ))}
        </Box>
    );
};

export default HierarchyTree;