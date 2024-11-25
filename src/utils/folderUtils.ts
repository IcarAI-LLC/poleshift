// src/utils/folderUtils.ts

import { v4 as uuidv4 } from 'uuid';
import { ExtendedTreeItem } from '../hooks/useFileTreeData';

export const processCreateFolder = async (
  inputs: Record<string, string>,
): Promise<ExtendedTreeItem> => {
  const { name } = inputs;
  if (!name) {
    throw new Error('Folder name is required to create a folder.');
  }

  const newId = `folder-${uuidv4()}`;
  return {
    id: newId,
    text: name,
    droppable: true,
    type: 'folder',
    children: [],
  };
};
