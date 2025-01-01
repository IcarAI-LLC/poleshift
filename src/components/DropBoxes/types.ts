import { DropboxConfigItem } from '@/config/dropboxConfig.ts';
import {
    Organizations,
    SampleGroupMetadata,
} from '@/lib/types';

export interface DropboxesProps {
    onError: (message: string) => void;
}

export interface SingleDropBoxProps {
    configItem: DropboxConfigItem;
    sampleGroup: SampleGroupMetadata;
    organization: Organizations | null;
    isLocked: boolean;
    onError: (message: string) => void;
}
