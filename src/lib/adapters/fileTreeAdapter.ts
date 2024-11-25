// lib/adapters/fileTreeAdapter.ts
import { FileNode, TreeNode, FileTreeAdapter } from '../types/fileTree';
import { TreeItem } from '../types/data';

export class DefaultFileTreeAdapter implements FileTreeAdapter {
    public fileNodeToTreeItem(node: FileNode): TreeItem {
        return {
            id: node.id,
            text: node.name,
            droppable: node.type === 'folder',
            type: node.type,
            parent_id: node.parent_id,
        };
    }

    public treeNodeToTreeItems(nodes: TreeNode[]): TreeItem[] {
        return nodes.map(node => ({
            ...this.fileNodeToTreeItem(node),
            children: node.children ? this.treeNodeToTreeItems(node.children) : undefined
        }));
    }
}