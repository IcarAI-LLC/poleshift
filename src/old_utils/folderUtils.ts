// src/utils/folderUtils.ts

import { v4 as uuidv4 } from 'uuid';
import { TreeItem } from '../components/LeftSidebar/LeftSidebarTree.tsx'

export const processCreateFolder = async (
  inputs: Record<string, string>,
): Promise<TreeItem> => {
  const { name } = inputs;
  if (!name) {
    throw new Error('Folder name is required to create a folder.');
  }

  const newId = uuidv4();
  return {
    id: newId,
    text: name,
    droppable: true,
    type: 'folder',
    children: [],
    parent_id: null,
  };
};
