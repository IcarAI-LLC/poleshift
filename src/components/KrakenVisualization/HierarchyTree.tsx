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

    // Create a map to store nodes by their depth
    const nodesByDepth = new Map<number, TreeNode[]>();

    // Map to keep track of nodes by taxId
    const nodeMap = new Map<number, TreeNode>();

    // Initialize result array to store root nodes
    const result: TreeNode[] = [];

    // Process each node to create TreeNode instances and group them by depth
    nodes.forEach((node) => {
        const treeNode: TreeNode = {
            ...node,
            children: [],
        };

        nodeMap.set(node.taxId, treeNode);

        if (!nodesByDepth.has(node.depth)) {
            nodesByDepth.set(node.depth, []);
        }
        nodesByDepth.get(node.depth)?.push(treeNode);
    });

    // Build the tree starting from depth 0
    const maxDepth = Math.max(...nodes.map((node) => node.depth));

    for (let depth = 0; depth <= maxDepth; depth++) {
        const currentLevelNodes = nodesByDepth.get(depth) || [];
        const parentLevelNodes = nodesByDepth.get(depth - 1) || [];

        currentLevelNodes.forEach((node) => {
            if (depth === 0) {
                // Root nodes
                result.push(node);
            } else {
                // Find the parent node
                const parentNode = parentLevelNodes[parentLevelNodes.length - 1];
                if (parentNode) {
                    parentNode.children.push(node);
                } else {
                    // If no parent found, treat as root
                    result.push(node);
                }
            }
        });
    }

    return result;
};

const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
};

const formatPercentage = (num: number): string => {
    return `${num.toFixed(2)}%`;
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
