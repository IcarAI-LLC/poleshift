import React, { useMemo } from 'react';
import { Typography, Box } from '@mui/material';

interface TaxonomyNode {
  name: string;
  taxId: number;
  rankCode: string;
  rankLevel: number;
  percentage: number;
  cladeReads: number;
  taxonReads: number;
  depth: number;
}

interface TreeNode extends TaxonomyNode {
  children: TreeNode[];
}

interface HierarchyTreeProps {
  nodes: TaxonomyNode[];
}

const buildTree = (nodes: TaxonomyNode[]): TreeNode[] => {
  if (!nodes?.length) return [];

  // Sort nodes by depth to ensure parents are processed before children
  const sortedNodes = [...nodes].sort((a, b) => a.depth - b.depth);

  // Create a map to store nodes by taxId for quick lookup
  const nodeMap = new Map<number, TreeNode>();

  // Initialize result array to store root nodes
  const result: TreeNode[] = [];

  // Process each node
  sortedNodes.forEach((node) => {
    // Create new tree node with empty children array
    const treeNode: TreeNode = {
      ...node,
      children: [],
    };

    // Add to node map for future lookups
    nodeMap.set(node.taxId, treeNode);

    // If this is a root node (depth 0), add to result
    if (node.depth === 0) {
      result.push(treeNode);
    } else {
      // Find parent node by looking at previous nodes with depth - 1
      const potentialParents = sortedNodes.filter(
        (n) => n.depth === node.depth - 1 && n.taxId !== node.taxId,
      );

      // Find the closest parent by checking the nodes
      const parent = potentialParents.find((p) => {
        // A node is a parent if its clade reads include the child's reads
        return p.cladeReads >= node.cladeReads;
      });

      if (parent) {
        const parentNode = nodeMap.get(parent.taxId);
        if (parentNode) {
          parentNode.children.push(treeNode);
        }
      } else {
        // If no parent found, add to root level
        result.push(treeNode);
      }
    }
  });

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
      ({node.rankCode})
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
      {formatNumber(node.cladeReads)} reads
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
      <Box sx={{ ml: 2, borderLeft: '1px solid #ccc', pl: 2 }}>
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
