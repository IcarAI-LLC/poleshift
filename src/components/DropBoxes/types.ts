import { DropboxConfigItem } from '../../config/dropboxConfig';
import {
    Organization,
    SampleGroupMetadata,
    ProcessedDataImproved,
} from '../../lib/types';

export interface DropboxesProps {
    onError: (message: string) => void;
}

export interface LocalModalState {
    isOpen: boolean;
    title: string;
    type: 'input' | 'data';
    modalInputs: Record<string, string>;
    uploadedFiles: string[];
    data?: any;
}

export interface SingleDropBoxProps {
    configItem: DropboxConfigItem;
    sampleGroup: SampleGroupMetadata;
    sampleLocation?: { lat: number; long: number } | null;
    organization: Organization | null;
    isLocked: boolean;
    onError: (message: string) => void;
}
