// src/utils/supabaseUtils.ts

import supabase from './supabaseClient';

/**
 * Remove Supabase channel subscription.
 */
export const removeSubscription = (channel: any) => {
  supabase.removeChannel(channel);
};

/**
 * Download a file from Supabase storage.
 */
export const downloadFileFromStorage = async (
  bucket: string,
  path: string,
): Promise<Blob | null> => {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error downloading file from storage:', error);
    return null;
  }
};

/**
 * Upload a file to Supabase storage.
 */
export const uploadFileToStorage = async (
  bucket: string,
  path: string,
  file: Blob,
) => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) {
    console.error(`Error uploading file to ${bucket}/${path}:`, error);
    throw error;
  }
};

/**
 * Remove files or folders from Supabase storage.
 */
export const removeFromStorage = async (bucket: string, paths: string[]) => {
  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error(`Error removing files/folders from ${bucket}:`, error);
    throw error;
  }
  return data;
};

/**
 * Fetch data from a Supabase table with optional filters.
 */
export const fetchData = async (
  table: string,
  filters: Record<string, any> = {},
  orgId?: string, // Optional orgId for scoping
) => {
  let query = supabase.from(table).select('*');
  if (orgId) {
    filters.org_id = orgId; // Add org_id to filters if provided
  }
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching data from ${table}:`, error);
    throw error;
  }
  return data;
};

/**
 * Insert data into a Supabase table with optional org scoping.
 */
export const insertData = async (
  table: string,
  data: any[],
  orgId?: string, // Optional orgId for scoping
) => {
  if (orgId) {
    data = data.map((item) => ({ ...item, org_id: orgId }));
  }
  const { data: insertData, error } = await supabase
    .from(table)
    .insert(data)
    .select('*');
  if (error) {
    console.error(`Error inserting data into ${table}:`, error);
    throw error;
  }
  return insertData;
};

/**
 * Upsert data into a Supabase table with optional org scoping.
 */
export const upsertData = async (
  table: string,
  data: any,
  conflictKey: string,
  orgId?: string, // Optional orgId for scoping
) => {
  if (orgId) {
    data = { ...data, org_id: orgId };
  }
  const { error } = await supabase
    .from(table)
    .upsert(data, { onConflict: conflictKey });
  if (error) {
    console.error(`Error upserting data into ${table}:`, error);
    throw error;
  }
};

/**
 * Subscribe to real-time changes in a Supabase table with org scoping.
 */
export const subscribeToTable = (
  table: string,
  filters: Record<string, any>,
  callback: (payload: any) => void,
  orgId?: string, // Optional orgId for scoping
) => {
  if (orgId) {
    filters.org_id = orgId; // Add org_id to filters if provided
  }
  const filterString = Object.entries(filters)
    .map(([key, value]) => `${key}=eq.${value}`)
    .join(',');
  const channel = supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: filterString,
      },
      callback,
    )
    .subscribe();
  return channel;
};

/**
 * Delete data from a Supabase table with optional org scoping.
 */
export const deleteData = async (
  table: string,
  filters: Record<string, any>,
  orgId?: string, // Optional orgId for scoping
) => {
  if (orgId) {
    filters.org_id = orgId; // Add org_id to filters if provided
  }
  let query = supabase.from(table).delete();
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { error } = await query;
  if (error) {
    console.error(`Error deleting data from ${table}:`, error);
    throw error;
  }
};

/**
 * List all files in a Supabase storage bucket recursively from a given path.
 */
export const listAllFiles = async (
  bucket: string,
  path: string,
): Promise<string[]> => {
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list(path);

  if (error) {
    console.error(`Error listing files in ${bucket}/${path}:`, error);
    throw error;
  }

  // Use item.name directly since it includes the full path
  const filePaths = files.map((item) => item.name);

  return filePaths;
};

/**
 * Fetch sample_metadata entries for a given human_readable_sample_id with optional org scoping.
 */
export const fetchSampleMetadataEntries = async (
  humanReadableSampleId: string,
  orgId?: string, // Optional orgId for scoping
) => {
  let query = supabase
    .from('sample_metadata')
    .select('*')
    .eq('human_readable_sample_id', humanReadableSampleId);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sample metadata:', error);
    throw error;
  }

  return data;
};

/**
 * Delete sample_metadata entries by a list of IDs with optional org scoping.
 */
export const deleteSampleMetadataEntries = async (
  ids: string[],
  orgId?: string, // Optional orgId for scoping
) => {
  let query = supabase.from('sample_metadata').delete().in('id', ids);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { error } = await query;

  if (error) {
    console.error('Error deleting sample metadata entries:', error);
    throw error;
  }
};
