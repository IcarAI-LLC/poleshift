// src/utils/sampleGroupUtils.ts

import supabase from './supabaseClient';
import { LocationOption } from '../old_hooks/useLocations';

export interface SampleGroup {
  id: string;
  name: string;
  human_readable_sample_id: string;
  loc_id: string;
  storage_folder: string;
  collection_date: string;
  collection_datetime_utc?: string;
  user_id: string;
  org_id: string;
  latitude_recorded: number | null;
  longitude_recorded: number | null;
  notes: string | null;
}

export interface SampleGroupData {
  [id: string]: SampleGroup;
}

export const processCreateSampleGroup = async (
    inputs: Record<string, string>,
    user: any,
    userOrgId: string,
    userOrgShortId: string,
    locations: LocationOption[],
    newId: string, // Accept the newId as a parameter
): Promise<SampleGroup> => {
  const { collectionDate, /* collectionTime, */ locCharId } = inputs;

  // Input validation
  if (!collectionDate || !locCharId) {
    throw new Error(
        'Collection date and location are required to create a sample group.',
    );
  }

  if (!userOrgId || !userOrgShortId) {
    throw new Error('Organization information is missing from user data.');
  }

  const userId = user?.id;
  if (!userId) {
    throw new Error('User is not authenticated');
  }

  // Format the date as YYYY-MM-DD
  const formattedDate = new Date(collectionDate).toISOString().split('T')[0];
  const baseName = `${formattedDate}-${locCharId}`;

  // Query the database directly for existing sample groups
  const { data: existingGroups, error } = await supabase
      .from('sample_group_metadata')
      .select('human_readable_sample_id')
      .like('human_readable_sample_id', `${baseName}-%-${userOrgShortId}`)
      .eq('org_id', userOrgId);

  if (error) {
    throw new Error(`Failed to fetch existing sample groups: ${error.message}`);
  }

  // Extract existing numbers
  const existingNumbers = existingGroups
      .map((group) => {
        const regex = new RegExp(`^${baseName}-(\\d{2})-${userOrgShortId}$`);
        const match = group.human_readable_sample_id.match(regex);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((num): num is number => num !== null);

  // Determine the next available number
  let nextNumber = 0;
  while (existingNumbers.includes(nextNumber)) {
    nextNumber += 1;
  }
  const formattedNumber = String(nextNumber).padStart(2, '0');

  // Construct the sample group name
  const sampleGroupName = `${baseName}-${formattedNumber}-${userOrgShortId}`;

  // Map locCharId to locId using the locations array
  const location = locations.find((loc) => loc.char_id === locCharId);

  if (!location) {
    throw new Error(`Location with char_id ${locCharId} not found.`);
  }

  const locId = location.id;

  // Create folder paths in Supabase Storage
  const storageFolder = `${userOrgShortId}/${sampleGroupName}/`;

  try {
    // Supabase Storage handles folder creation implicitly via object paths.
    // To simulate folder creation, upload a placeholder file.
    const placeholderContent = new Blob(['a'], { type: 'text/plain' });

    // Upload placeholder file to raw-data bucket
    const { error: rawError } = await supabase.storage
        .from('raw-data')
        .upload(`${storageFolder}index_file.poleshift`, placeholderContent, {
          upsert: false,
        });

    if (rawError) {
      throw new Error(
          `Failed to create folder in "raw-data": ${rawError.message}`,
      );
    }

    // Construct the SampleGroup object
    const newSampleGroup: SampleGroup = {
      id: newId,
      name: sampleGroupName,
      human_readable_sample_id: sampleGroupName,
      loc_id: locId,
      storage_folder: storageFolder,
      collection_date: collectionDate,
      // collection_datetime_utc: collection_datetime_utc || undefined,
      user_id: userId,
      org_id: userOrgId,
      latitude_recorded: null,
      longitude_recorded: null,
      notes: null,
    };

    return newSampleGroup;
  } catch (error: any) {
    console.error('Error in processCreateSampleGroup:', error);
    throw new Error(`Failed to create sample group: ${error.message}`);
  }
};