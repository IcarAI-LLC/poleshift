// src/renderer/config/dropboxConfig.ts

import { DataType } from '@/lib/powersync/DrizzleSchema.ts';

export interface ModalField {
  name: string;
  label?: string;
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'number'
    | 'date'
    | 'time'
    | 'timezone'
    | 'location';
  tooltip?: string;
  required?: boolean;
}

export interface DropboxConfigItem {
  id: DataType;
  label: string;
  dataType: DataType;
  expectedFileTypes: Record<string, string[]> | null;
  isEnabled: boolean;
  isModalInput: boolean;
  processFunctionName: string;
  requiredSubscriptionLevel?: number;
  modalFields: ModalField[];
  acceptsMultipleFiles?: boolean;
  tooltip?: string;
}

const dropboxConfig: DropboxConfigItem[] = [
  {
    id: DataType.NutrientAmmonia,
    label: 'Nutrient Ammonia',
    dataType: DataType.NutrientAmmonia,
    expectedFileTypes: null,
    isEnabled: true,
    isModalInput: true,
    processFunctionName: 'handle_nutrient_ammonia',
    requiredSubscriptionLevel: 1,
    modalFields: [
      {
        name: 'ammoniaValue',
        type: 'number',
        label: 'Ammonia Value',
        tooltip:
          'Please input the Ammonia value, this will be converted to Ammonium.',
      },
    ],
  },

  {
    id: DataType.CTD,
    label: 'CTD Data',
    dataType: DataType.CTD,
    expectedFileTypes: { 'application/octet-stream': ['.rsk'] },
    isEnabled: true,
    isModalInput: false,
    processFunctionName: 'handle_ctd_data',
    requiredSubscriptionLevel: 1,
    modalFields: [],
  },

  {
    id: DataType.Sequence,
    label: 'Sequencing Data',
    dataType: DataType.Sequence,
    expectedFileTypes: {
      'text/plain': ['.fastq', '.fq', '.fasta', '.fa', '.gz'],
    },
    isEnabled: true,
    isModalInput: false,
    processFunctionName: 'handle_sequence_data',
    requiredSubscriptionLevel: 1,
    modalFields: [],
    acceptsMultipleFiles: true,
  },
];

export default dropboxConfig;
