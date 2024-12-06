import React, { useMemo, useState } from 'react';
import { ResponsiveSunburst } from '@nivo/sunburst';
import { Box, Button, Typography } from '@mui/material';

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
    id: string;
    name: string;
    percentage: number;
    children?: TreeNode[];
    value?: number;
    color?: string;
    reads?: number;
}

interface TaxonomyStarburstProps {
    nodes: TaxonomyNode[];
}

const buildTree = (nodes: TaxonomyNode[]): TreeNode => {
    if (!nodes || nodes.length === 0) {
        throw new Error("No nodes provided to build the tree.");
    }

    const rootNodeData = nodes.find(node => node.depth === 1);
    if (!rootNodeData) {
        throw new Error("No root node found (node with depth=1).");
    }

    const rootNode: TreeNode = {
        id: `${rootNodeData.name}-${rootNodeData.taxId}-${rootNodeData.depth}`,
        name: rootNodeData.name,
        percentage: rootNodeData.percentage,
        children: [],
    };

    const stack: { node: TreeNode; depth: number }[] = [{ node: rootNode, depth: rootNodeData.depth }];

    nodes
        .filter(node => node !== rootNodeData)
        .forEach((node) => {
            const treeNode: TreeNode = {
                id: `${node.name}-${node.taxId}-${node.depth}`,
                name: node.name,
                percentage: node.percentage,
                children: [],
            };

            while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
                stack.pop();
            }

            if (stack.length === 0) {
                rootNode.children?.push(treeNode);
            } else {
                const parent = stack[stack.length - 1].node;
                parent.children?.push(treeNode);
            }

            stack.push({ node: treeNode, depth: node.depth });
        });

    const assignValues = (node: TreeNode) => {
        const correspondingNode = nodes.find(
            (n) => `${n.name}-${n.taxId}-${n.depth}` === node.id
        );

        if (correspondingNode) {
            // Store the actual value directly
            node.value = correspondingNode.taxReads;
            node.reads = correspondingNode.reads;
        }

        if (node.children) {
            node.children.forEach(assignValues);
        }
    };

    assignValues(rootNode);
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

    // @ts-ignore
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
                enableArcLabels={false}
                tooltip={(node ) => {
                    // Use the stored percentage instead of Nivo's calculated one
                    const nodeData = node.data as TreeNode;
                    return (
                        <Box
                            sx={{
                                bgcolor: 'rgba(0, 0, 0, 0.75)',
                                color: 'white',
                                padding: '5px 10px',
                                borderRadius: '4px',
                            }}
                        >
                            <Typography variant="body2">
                                {nodeData.name}: {nodeData.reads?.toLocaleString()} reads ({nodeData.percentage.toFixed(2)}%)
                            </Typography>
                        </Box>
                    );
                }}
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