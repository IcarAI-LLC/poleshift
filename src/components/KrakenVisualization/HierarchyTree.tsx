
import { useMemo, useState } from "react";
import { Folder, FolderOpen, FlaskConical } from "lucide-react";

import type { ProcessedKrakenUniqReport } from "@/lib/types";
import { TaxonomicRank } from "@/lib/powersync/DrizzleSchema";

interface TaxonomyFileNode {
    id: string;
    name: string;
    rank: TaxonomicRank;
    percentage: number;
    reads: number;
    tax_id: number;
    children?: TaxonomyFileNode[];
    type: "folder" | "leaf";
}

function formatNumber(num: number | string): string {
    const value = typeof num === "string" ? parseInt(num) : num;
    return new Intl.NumberFormat("en-US").format(value);
}

function formatPercentage(num: number): string {
    return `${num.toFixed(2)}%`;
}

/**
 * Build a hierarchy of nodes from the raw `ProcessedKrakenUniqReport[]`
 */
function buildHierarchyTree(data: ProcessedKrakenUniqReport[]): TaxonomyFileNode[] {
    const nodeMap = new Map<string, TaxonomyFileNode>();

    // 1) Create a node for each item
    data.forEach((item) => {
        nodeMap.set(item.id, {
            id: item.id,
            name: item.tax_name,
            rank: item.rank as TaxonomicRank,
            percentage: item.percentage,
            reads: item.reads,
            tax_id: item.tax_id,
            type: "leaf",
            children: [],
        });
    });

    // 2) Link children to parents
    const roots: TaxonomyFileNode[] = [];
    data.forEach((item) => {
        const node = nodeMap.get(item.id);
        if (!node) return;

        if (item.parent_id && nodeMap.has(item.parent_id)) {
            const parent = nodeMap.get(item.parent_id)!;
            parent.children?.push(node);
            parent.type = "folder"; // indicates parent has children
        } else {
            // Node is root if no parent or parent not in dataset
            roots.push(node);
        }
    });

    return roots;
}

interface TaxonomyNodeProps {
    node: TaxonomyFileNode;
    depth?: number; // track nesting level
}

/**
 * Recursively render a node + children with collapse/expand logic.
 */
function TaxonomyNode({ node, depth = 0 }: TaxonomyNodeProps) {
    const hasChildren = node.children && node.children.length > 0;

    // Root folders (depth === 0) start open; everything else starts closed
    const [isOpen, setIsOpen] = useState(depth === 0);

    const handleToggle = () => {
        if (node.type === "folder") {
            setIsOpen((prev) => !prev);
        }
    };

    return (
        <li className="ml-4 list-none">
            {/* Row: icon + name + rank + percentage + reads */}
            <div
                className="flex items-center gap-2 text-sm cursor-pointer"
                onClick={handleToggle}
            >
                {node.type === "folder" ? (
                    isOpen ? (
                        <FolderOpen className="h-4 w-4 text-gray-500" />
                    ) : (
                        <Folder className="h-4 w-4 text-gray-500" />
                    )
                ) : (
                    <FlaskConical className="h-4 w-4 text-cyan-500" />
                )}
                <span className="font-medium">{node.name}</span>
                <span className="text-xs text-gray-500">({node.rank})</span>
                <span className="text-xs text-gray-500">{formatPercentage(node.percentage)}</span>
                <span className="text-xs text-gray-500">{formatNumber(node.reads)} reads</span>
            </div>

            {/* Children (only show if folder & open) */}
            {hasChildren && isOpen && (
                <ul className="ml-2 mt-1 border-l border-gray-300 pl-2">
                    {node.children!.map((child) => (
                        <TaxonomyNode key={child.id} node={child} depth={depth + 1} />
                    ))}
                </ul>
            )}
        </li>
    );
}

interface HierarchyTreeProps {
    data: ProcessedKrakenUniqReport[];
}

export default function HierarchyTree({ data }: HierarchyTreeProps) {
    // 1) Build tree
    const fileNodes = useMemo(() => buildHierarchyTree(data), [data]);

    // 2) If no data
    if (!data?.length) {
        return <p className="text-center text-gray-500">No hierarchy data available</p>;
    }

    return (
        <div className="w-full">
            {/* Show total nodes */}
            <p className="mb-1 text-xs text-gray-500">Total nodes: {data.length}</p>

            {/* Container with scroll, border, etc. */}
            <div className="max-h-[800px] overflow-y-auto border border-gray-300 rounded p-2 text-sm">
                <ul>
                    {fileNodes.map((root) => (
                        <TaxonomyNode key={root.id} node={root} />
                    ))}
                </ul>
            </div>
        </div>
    );
}
