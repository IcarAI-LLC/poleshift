// src/components/TaxonomyStarburst.tsx

import React, { useMemo, useState } from 'react';
import { ResponsiveSunburst } from '@nivo/sunburst';
import { Box, Button } from '@mui/material';

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

interface TreeNode {
    name: string;
    children?: TreeNode[];
    value?: number;
    color?: string;
}

interface TaxonomyStarburstProps {
    nodes: TaxonomyNode[];
}

const buildTree = (nodes: TaxonomyNode[], rootName: string): TreeNode => {
    if (!nodes || nodes.length === 0) return { name: rootName, children: [] };

    const rootNode: TreeNode = { name: rootName, children: [] };
    const stack: { node: TreeNode; depth: number }[] = [];

    nodes.forEach((node) => {
        const treeNode: TreeNode = {
            id: `${node.name}-${node.taxId}-${node.depth}`,
            name: node.name,
            value: node.reads || 1, // Ensure value is at least 1
            children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
            stack.pop();
        }

        if (stack.length === 0) {
            // Add to root
            rootNode.children?.push(treeNode);
        } else {
            const parent = stack[stack.length - 1].node;
            parent.children?.push(treeNode);
        }

        stack.push({ node: treeNode, depth: node.depth });
    });

    return rootNode;
};

const TaxonomyStarburst: React.FC<TaxonomyStarburstProps> = ({ nodes }) => {
    const [currentNode, setCurrentNode] = useState<TreeNode | null>(null);

    const data = useMemo(() => {
        const treeData = buildTree(nodes, 'Life');
        return currentNode || treeData;
    }, [nodes, currentNode]);

    const handleClick = (node: any) => {
        if (node.data.children && node.data.children.length > 0) {
            setCurrentNode(node.data);
        }
    };

    const handleReset = () => {
        setCurrentNode(null);
    };

    return (
        <Box position="relative" height={600}>
            <ResponsiveSunburst
                data={data}
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                id="id"
                value="value"
                cornerRadius={2}
                borderColor={{ theme: 'background' }}
                colors={{ scheme: 'nivo' }}
                childColor={{ from: 'color' }}
                animate={true}
                motionConfig="gentle"
                onClick={handleClick}
                tooltip={({ id, value, percentage }) => (
                    <strong>
                        {id}: {value} reads ({percentage.toFixed(2)}%)
                    </strong>
                )}
            />
            {currentNode && (
                <Box position="absolute" top={10} right={10}>
                    <Button variant="contained" onClick={handleReset}>
                        Reset
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default TaxonomyStarburst;
