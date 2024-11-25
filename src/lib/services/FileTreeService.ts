// lib/services/FileTreeService.ts
import { storage } from '../storage';
import { api } from '../api';
import { FileNode, TreeNode } from '../types/fileTree';
import { TreeItem, SampleGroup } from '../types';
import { APIError, StorageError } from '../types/errors';
import { DefaultFileTreeAdapter } from '../adapters/fileTreeAdapter';

export class FileTreeService {
    private static adapter = new DefaultFileTreeAdapter();

    public static async createFolder(
        orgId: string,
        name: string,
        parentId: string | null = null
    ): Promise<TreeItem> {
        try {
            // If online, create on server first
            if (navigator.onLine) {
                const node = await api.fileTree.createFolder(orgId, name, parentId);
                const treeItem = this.adapter.fileNodeToTreeItem(node);
                await storage.saveTreeItem(treeItem);
                return treeItem;
            }

            // If offline, create locally and queue for sync
            const node: FileNode = {
                id: crypto.randomUUID(),
                org_id: orgId,
                parent_id: parentId,
                name,
                type: 'folder',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                version: 1
            };

            const treeItem = this.adapter.fileNodeToTreeItem(node);
            await storage.saveTreeItem(treeItem);
            await storage.addPendingOperation({
                type: 'insert',
                table: 'file_nodes',
                data: node,
                timestamp: Date.now()
            });

            return treeItem;
        } catch (error) {
            if (error instanceof Error) {
                throw new APIError('Failed to create folder', error);
            }
            throw error;
        }
    }

    public static async createSampleGroupNode(
        sampleGroup: SampleGroup,
        parentId: string | null = null
    ): Promise<TreeItem> {
        try {
            // If online, create on server first
            if (navigator.onLine) {
                const node = await api.fileTree.createSampleGroupNode(
                    sampleGroup.org_id,
                    sampleGroup.id,
                    sampleGroup.name,
                    parentId
                );
                const treeItem = this.adapter.fileNodeToTreeItem(node);
                await storage.saveTreeItem(treeItem);
                return treeItem;
            }

            // If offline, create locally and queue for sync
            const node: FileNode = {
                id: crypto.randomUUID(),
                org_id: sampleGroup.org_id,
                parent_id: parentId,
                name: sampleGroup.name,
                type: 'sampleGroup',
                sample_group_id: sampleGroup.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                version: 1
            };

            const treeItem = this.adapter.fileNodeToTreeItem(node);
            await storage.saveTreeItem(treeItem);
            await storage.addPendingOperation({
                type: 'insert',
                table: 'file_nodes',
                data: node,
                timestamp: Date.now()
            });

            return treeItem;
        } catch (error) {
            if (error instanceof Error) {
                throw new APIError('Failed to create sample group node', error);
            }
            throw error;
        }
    }

    public static async moveNode(
        id: string,
        newParentId: string | null
    ): Promise<TreeItem> {
        try {
            const existingTreeItem = await storage.getTreeItem(id);
            if (!existingTreeItem) throw new StorageError('Node not found');

            // Update locally
            const updatedTreeItem: TreeItem = {
                ...existingTreeItem,
                parent_id: newParentId
            };
            await storage.saveTreeItem(updatedTreeItem);

            // If online, update server
            if (navigator.onLine) {
                const serverNode = await api.fileTree.moveNode(id, newParentId);
                const treeItem = this.adapter.fileNodeToTreeItem(serverNode);
                await storage.saveTreeItem(treeItem);
                return treeItem;
            }

            // If offline, queue for sync
            await storage.addPendingOperation({
                type: 'update',
                table: 'file_nodes',
                data: { id, updates: { parent_id: newParentId } },
                timestamp: Date.now()
            });

            return updatedTreeItem;
        } catch (error) {
            if (error instanceof Error) {
                throw new APIError('Failed to move node', error);
            }
            throw error;
        }
    }

    public static getTreeItems(nodes: FileNode[]): TreeItem[] {
        const treeNodes = this.buildTree(nodes);
        return this.adapter.treeNodeToTreeItems(treeNodes);
    }

    private static buildTree(nodes: FileNode[]): TreeNode[] {
        const nodeMap = new Map<string, TreeNode>();
        const roots: TreeNode[] = [];

        // First pass: create all nodes
        nodes.forEach(node => {
            nodeMap.set(node.id, { ...node, children: [] });
        });

        // Second pass: establish relationships
        nodes.forEach(node => {
            const treeNode = nodeMap.get(node.id)!;
            if (node.parent_id === null) {
                roots.push(treeNode);
            } else {
                const parent = nodeMap.get(node.parent_id);
                if (parent) {
                    parent.children = parent.children || [];
                    parent.children.push(treeNode);
                }
            }
        });

        return roots;
    }
}