// lib/types/fileTree.ts
import {TreeItem} from "./data.ts";

export interface FileNode {
    id: string;
    org_id: string;
    parent_id: string | null;
    name: string;
    type: 'folder' | 'sampleGroup';
    created_at: string;
    updated_at: string;
    version: number;
    sample_group_id?: string;
}

export interface TreeNode extends FileNode {
    children?: TreeNode[];
}

// New adapter types interface
export interface FileTreeAdapter {
    fileNodeToTreeItem(node: FileNode): TreeItem;
    treeNodeToTreeItems(nodes: TreeNode[]): TreeItem[];
}