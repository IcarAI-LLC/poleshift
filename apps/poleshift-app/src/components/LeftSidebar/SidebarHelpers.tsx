// components/LeftSidebar/sidebarHelpers.ts
import {
  Ban,
  DatabaseIcon,
  FlaskConical,
  Folder as FolderClosedIcon,
  FolderOpen as FolderOpenIcon,
} from 'lucide-react';

import PenguinIcon from '@/assets/icons/penguin.svg';
import { FileNodeWithChildren } from '@/hooks/useData';
import { FileNodeType, ProximityCategory } from '@/lib/powersync/DrizzleSchema';

/**
 * Returns the appropriate icon for a node type (Folder, Container, SampleGroup, etc.)
 */
export function getNodeIcon(node: FileNodeWithChildren, expanded: boolean) {
  if (node.type === FileNodeType.Folder) {
    return expanded ? (
      <FolderOpenIcon className='h-4 w-4' />
    ) : (
      <FolderClosedIcon className='h-4 w-4' />
    );
  }
  if (node.type === FileNodeType.Container) {
    return <DatabaseIcon className='h-4 w-4' />;
  }
  if (node.type === FileNodeType.SampleGroup) {
    if (node.excluded) {
      return <Ban className='h-4 w-4 stroke-red-500' />;
    }
    if (node.penguin_present) {
      return <img src={PenguinIcon} alt='Penguin' className='h-4 w-4' />;
    }
    return <FlaskConical className='h-4 w-4 stroke-cyan-500' />;
  }
  return null;
}

/**
 * Converts a proximity enum into a user-friendly label (Close, Far1, Far2)
 */
export function getProximityLabel(cat?: ProximityCategory | null) {
  switch (cat) {
    case ProximityCategory.Close:
      return 'Close';
    case ProximityCategory.Far1:
      return 'Far1';
    case ProximityCategory.Far2:
      return 'Far2';
    default:
      return null;
  }
}
