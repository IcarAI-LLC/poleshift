import { DropboxConfigItem } from '../../config/dropboxConfig';
import {
    Organization,
    SampleGroupMetadata,
} from '../../lib/types';

export interface DropboxesProps {
    onError: (message: string) => void;
}

export interface SingleDropBoxProps {
    configItem: DropboxConfigItem;
    sampleGroup: SampleGroupMetadata;
    organization: Organization | null;
    isLocked: boolean;
    onError: (message: string) => void;
}
