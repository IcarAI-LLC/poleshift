// src/renderer/config/dropboxConfig.ts

export interface ModalField {
  name: string;
  label?: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date'; // Added 'date' type
  options?: string[]; // Only applicable for 'select' type
  tooltip?: string;
}

export interface DropboxConfigItem {
  id: string; // Unique identifier, now using dataType
  label: string;
  dataType: string; // The type of data
  expectedFileTypes: Record<string, string[]> | null;
  isEnabled: boolean;
  isModalInput: boolean;
  processFunctionName: string;
  requiredSubscriptionLevel?: number;
  modalFields: ModalField[];
  acceptsMultipleFiles?: boolean; // Optional, default is false
  tooltip?: string;
}

const dropboxConfig: DropboxConfigItem[] = [
  {
    id: 'nutrient_ammonia', // Using dataType as id
    label: 'Nutrient Ammonia',
    dataType: 'nutrient_ammonia',
    expectedFileTypes: null,
    isEnabled: true,
    isModalInput: true,
    processFunctionName: 'handleNutrientAmmoniaInput',
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
    id: 'ctd_data',
    label: 'CTD Data',
    dataType: 'ctd_data',
    expectedFileTypes: { 'application/octet-stream': ['.rsk'] },
    isEnabled: true,
    isModalInput: false,
    processFunctionName: 'handleCTDDataUpload',
    requiredSubscriptionLevel: 1,
    modalFields: [], // No modal inputs needed for CTD data
  },

  {
    id: 'sequencing_data', // New entry for sequencing data
    label: 'Sequencing Data',
    dataType: 'sequencing_data',
    expectedFileTypes: {
      'application/gzip': ['.fastq.gz', '.fq.gz', '.fasta.gz', '.fa.gz'],
      'text/plain': ['.fastq', '.fq', '.fasta', '.fa'],
    },
    isEnabled: true,
    isModalInput: false,
    processFunctionName: 'handleSequencingData',
    requiredSubscriptionLevel: 1, // Adjust subscription level as needed
    modalFields: [], // No modal inputs needed for sequencing data
    acceptsMultipleFiles: true,
  },
];

export default dropboxConfig;
