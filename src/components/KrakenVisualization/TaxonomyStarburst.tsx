import React, { useMemo, useState } from 'react';
import {ComputedDatum, ResponsiveSunburst} from '@nivo/sunburst';
import { Box, Button, Typography } from '@mui/material';

interface TaxonomyNode {
    name: string;
    tax_id: number;
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
    id: string;
    name: string;
    rank: string;
    children?: TreeNode[];
    value: number; // This will be taxReads - direct reads for this node
    depth: number;
}

interface TaxonomyStarburstProps {
    nodes: TaxonomyNode[];
}

const buildTree = (nodes: TaxonomyNode[]): TreeNode => {
    if (!nodes || nodes.length === 0) {
        throw new Error("No nodes provided to build the tree.");
    }

    // Find root node (Life or Root)
    const rootNodeData = nodes.find(node =>
        node.name === "Life" || node.name === "Root"
    );

    if (!rootNodeData) {
        throw new Error("No root node (Life or Root) found.");
    }

    // Create root node
    const rootNode: TreeNode = {
        id: `${rootNodeData.name}-${rootNodeData.tax_id}`,
        name: rootNodeData.name,
        rank: rootNodeData.rank,
        value: rootNodeData.taxReads,
        children: [],
        depth: rootNodeData.depth
    };

    const stack: TreeNode[] = [rootNode];

    // Process all nodes except root
    nodes
        .filter(node => node !== rootNodeData)
        .forEach((node) => {
            const treeNode: TreeNode = {
                id: `${node.name}-${node.tax_id}`,
                name: node.name,
                rank: node.rank,
                value: node.taxReads,
                children: [],
                depth: node.depth,
            };

            // Adjust the stack based on the depth
            while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
                stack.pop();
            }

            if (stack.length > 0) {
                // Add as a child to the last node in stack
                const parent = stack[stack.length - 1];
                parent.children = parent.children || [];
                parent.children.push(treeNode);
            }

            // Push current node onto the stack
            stack.push(treeNode);
        });

    return rootNode;
};

const TaxonomyStarburst: React.FC<TaxonomyStarburstProps> = ({ nodes }) => {
    const [currentNode, setCurrentNode] = useState<TreeNode | null>(null);
    const [overlayText, setOverlayText] = useState<string>('');

    const data = useMemo(() => {
        const treeData = buildTree(nodes);
        return currentNode || treeData;
    }, [nodes, currentNode]);

    const handleClick = (node: any) => {
        if (node.data.children && node.data.children.length > 0) {
            setCurrentNode(node.data);
            setOverlayText(node.data.name);
        }
    };

    const handleReset = () => {
        setCurrentNode(null);
        setOverlayText('');
    };

    const formatTooltip = (node: ComputedDatum<TreeNode>) => {
        const totalValue = node.value;
        const percentage = node.percentage;
        return `${node.data.name} (${node.data.rank}): ${totalValue.toLocaleString()} reads (${percentage}%)`;
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
                enableArcLabels={true}
                arcLabel="name"
                arcLabelsSkipAngle={10}
                tooltip={(node) => (
                    <Box
                        sx={{
                            bgcolor: 'rgba(0, 0, 0, 0.75)',
                            color: 'white',
                            padding: '5px 10px',
                            borderRadius: '4px',
                        }}
                    >
                        <Typography variant="body2">
                            {formatTooltip(node)}
                        </Typography>
                    </Box>
                )}
            />

            {overlayText && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        bgcolor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        textAlign: 'center',
                    }}
                >
                    <Typography variant="h6">{overlayText}</Typography>
                </Box>
            )}

            {currentNode && (
                <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
                    <Button variant="contained" onClick={handleReset}>
                        Reset
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default TaxonomyStarburst;