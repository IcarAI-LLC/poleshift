// lib/api/fileTree.ts
import { apiClient } from './client';
import { FileNode } from '../types/fileTree';

export const fileTree = {
    async getFileNodes(orgId: string): Promise<FileNode[]> {
        const { data, error } = await apiClient
            .getClient()
            .from('file_nodes')
            .select('*')
            .eq('org_id', orgId);

        if (error) throw error;
        return data;
    },

    async createFolder(
        orgId: string,
        name: string,
        parentId: string | null = null
    ): Promise<FileNode> {
        const { data, error } = await apiClient
            .getClient()
            .from('file_nodes')
            .insert({
                org_id: orgId,
                parent_id: parentId,
                name,
                type: 'folder'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async createSampleGroupNode(
        orgId: string,
        sampleGroupId: string,
        name: string,
        parentId: string | null = null
    ): Promise<FileNode> {
        const { data, error } = await apiClient
            .getClient()
            .from('file_nodes')
            .insert({
                org_id: orgId,
                parent_id: parentId,
                name,
                type: 'sampleGroup',
                sample_group_id: sampleGroupId
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateNode(
        id: string,
        updates: Partial<Omit<FileNode, 'id' | 'type'>>
    ): Promise<FileNode> {
        const { data, error } = await apiClient
            .getClient()
            .from('file_nodes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async moveNode(id: string, newParentId: string | null): Promise<FileNode> {
        const { data, error } = await apiClient
            .getClient()
            .from('file_nodes')
            .update({ parent_id: newParentId })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteNode(id: string): Promise<void> {
        const { error } = await apiClient
            .getClient()
            .from('file_nodes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};