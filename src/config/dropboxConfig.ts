// src/renderer/config/dropboxConfig.ts

export interface ModalField {
  name: string;
  label?: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'time' | 'timezone';
  options?: any;
  tooltip?: string;
  required?: boolean;
}

export interface DropboxConfigItem {
  id: string;
  label: string;
  dataType: string;
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
    id: 'nutrient_ammonia',
    label: 'Nutrient Ammonia',
    dataType: 'nutrient_ammonia',
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
        tooltip: 'Please input the Ammonia value, this will be converted to Ammonium.',
      },
    ],
  },

  {
    id: 'ctd_data',
    label: 'CTD Data',
    dataType: 'ctd_data',
    expectedFileTypes: { 'application/octet-stream': ['.rsk'] },
    isEnabled: true,
    isModalInput: false,
    processFunctionName: 'handle_ctd_data_upload',
    requiredSubscriptionLevel: 1,
    modalFields: [],
  },

  {
    id: 'sequencing_data',
    label: 'Sequencing Data',
    dataType: 'sequencing_data',
    expectedFileTypes: {
      'text/plain': ['.fastq', '.fq', '.fasta', '.fa'],
      'application/gzip': ['.fastq.gz', '.fq.gz', '.fasta.gz', '.fa.gz'],
      // Removed 'application/plain' as it's invalid
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
