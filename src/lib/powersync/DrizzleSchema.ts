import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { UserRole } from '../../types';

export enum DataType {
  CTD = 'ctd',
  Sequence = 'sequence',
  NutrientAmmonia = 'nutrient_ammonia',
}

export enum ProcessingState {
  Initiated = 'initiated',
  Processing = 'processing',
  Complete = 'complete',
  Error = 'error',
  Saving = 'saving',
}

export enum ProximityCategory {
  Close = 'Close',
  Far1 = 'Far1',
  Far2 = 'Far2',
}

export enum ServerStatus {
  Healthy = 'healthy',
  Unhealthy = 'unhealthy',
}

export enum TaxonomicRank {
  Root = 'root',
  Domain = 'domain',
  Supergroup = 'supergroup',
  Division = 'division',
  Subdivision = 'subdivision',
  Class = 'class',
  Order = 'order',
  Family = 'family',
  Genus = 'genus',
  Species = 'species',
  Assembly = 'assembly',
  Sequence = 'sequence',
}

export enum FileNodeType {
  Folder = 'folder',
  SampleGroup = 'sampleGroup',
  Container = 'container',
}

export enum PenguinCountType {
  Adults = 'adults',
  Chicks = 'chicks',
  Nests = 'nests',
}
/** ─────────────────────────────────────────────────────────────────────────────
 *  2) organizations
 *  ────────────────────────────────────────────────────────────────────────────**/
export const organizations = sqliteTable('organizations', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  name: text('name').notNull(),
  created_at: text('created_at').default(DateTime.now().toISO()).notNull(),
  org_short_id: text('org_short_id').notNull().default('ZZZZ'),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  3) user_profiles
 *     - The metadata shows "id" repeated (once referencing `users.id` and again
 *       marked as PK). Drizzle doesn't allow `.references(...)` and `.primaryKey()`
 *       on the same column directly, so we combine them carefully.
 *  ────────────────────────────────────────────────────────────────────────────**/
export const user_profiles = sqliteTable('user_profiles', {
  // Single "id" column that is both the PK and references "users.id"
  id: text('id').notNull().primaryKey(),
  organization_id: text('organization_id').references(() => organizations.id),
  created_at: text('created_at').default(DateTime.now().toISO()).notNull(),
  user_role: text('user_role' /* user-defined type */)
    .$type<UserRole>()
    .notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  4) sample_locations
 *  ────────────────────────────────────────────────────────────────────────────**/
export const sample_locations = sqliteTable('sample_locations', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  label: text('label').notNull(),
  lat: real('lat').notNull(),
  long: real('long').notNull(),
  is_enabled: real('is_enabled').notNull(),
  char_id: text('char_id').notNull(),
  external_penguin_data_id: integer('external_penguin_data_id').references(
    () => external_database_penguin_data.id
  ),
  external_scar_id: text('external_scar_id').references(
    () => external_database_scar_locations.id
  ),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  5) sample_group_metadata
 *  ────────────────────────────────────────────────────────────────────────────**/
export const sample_group_metadata = sqliteTable('sample_group_metadata', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  created_at: text('created_at').notNull().default(DateTime.now().toISO()),
  org_id: text('org_id').references(() => organizations.id),
  user_id: text('user_id').references(() => user_profiles.id),
  human_readable_sample_id: text('human_readable_sample_id').notNull(),
  collection_date: text('collection_date').notNull(),
  collection_datetime_utc: text('collection_datetime_utc'),
  loc_id: text('loc_id')
    .notNull()
    .references(() => sample_locations.id),
  latitude_recorded: real('latitude_recorded'),
  longitude_recorded: real('longitude_recorded'),
  notes: text('notes'),
  updated_at: text('updated_at').notNull(),
  proximity_category: text('proximity_category').$type<ProximityCategory>(),
  excluded: integer('excluded').notNull().$type<boolean>(),
  penguin_count: integer('penguin_count'),
  penguin_present: integer('penguin_present').notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  7) file_nodes
 *  ────────────────────────────────────────────────────────────────────────────**/
export const file_nodes = sqliteTable('file_nodes', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  org_id: text('org_id')
    .notNull()
    .references(() => organizations.id),
  parent_id: text('parent_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  created_at: text('created_at').notNull().default(DateTime.now().toISO()),
  updated_at: text('updated_at').notNull().default(DateTime.now().toISO()),
  version: integer('version').notNull().default(1),
  sample_group_id: text('sample_group_id').references(
    () => sample_group_metadata.id
  ),
  droppable: integer('droppable').notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  8) license_keys
 *  ────────────────────────────────────────────────────────────────────────────**/
export const license_keys = sqliteTable('license_keys', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  organization_id: text('organization_id').references(() => organizations.id),
  key: text('key').notNull().default(uuidv4()),
  is_active: integer('is_active').default(1),
  created_at: text('created_at').default(DateTime.now().toISO()),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  10) role_permissions
 *  ────────────────────────────────────────────────────────────────────────────**/
export const role_permissions = sqliteTable('role_permissions', {
  id: text('id').notNull().primaryKey(),
  role: text('role').$type<UserRole>().notNull(),
  permission: text('permission').$type<Permissions>().notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  11) user_roles
 *  ────────────────────────────────────────────────────────────────────────────**/
export const user_roles = sqliteTable('user_roles', {
  id: text('id').notNull().primaryKey(),
  user_id: text('user_id')
    .notNull()
    .references(() => user_profiles.id),
  role: text('role').$type<UserRole>().notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  12) scar_locations
 *  ────────────────────────────────────────────────────────────────────────────**/
export const external_database_scar_locations = sqliteTable(
  'external_database_scar_locations',
  {
    id: text('id').notNull().primaryKey(),
    narrative: text('narrative').notNull(),
  }
);

/** ─────────────────────────────────────────────────────────────────────────────
 *  13) penguin_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export const external_database_penguin_data = sqliteTable(
  'external_database_penguin_data',
  {
    id: text('id').notNull().primaryKey(),
    penguin_count: integer('penguin_count').notNull(),
    day: integer('day'),
    month: integer('month'),
    year: integer('year').notNull(),
    common_name: text('common_name').notNull(),
    count_type: text('count_type').notNull().$type<PenguinCountType>(),
  }
);

/** ─────────────────────────────────────────────────────────────────────────────
 *  14) organization_settings
 *  ────────────────────────────────────────────────────────────────────────────**/
export const organization_settings = sqliteTable('organization_settings', {
  id: text('id').notNull().primaryKey(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  15) user_settings
 *  ────────────────────────────────────────────────────────────────────────────**/
export const user_settings = sqliteTable('user_settings', {
  id: text('id')
    .notNull()
    .references(() => user_profiles.id),
  taxonomic_starburst_max_rank: text('taxonomic_starburst_max_rank')
    .notNull()
    .$type<TaxonomicRank>(),
  globe_datapoint_poles: integer('globe_datapoint_poles').notNull(),
  globe_datapoint_color: text('globe_datapoint_color').notNull(),
  globe_datapoint_diameter: text('globe_datapoint_diameter').notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  16) processed_data_improved
 *  ────────────────────────────────────────────────────────────────────────────**/
export const processed_data_improved = sqliteTable('processed_data_improved', {
  id: text('id').notNull().primaryKey(),
  data_type: text('data_type').notNull().$type<DataType>(),
  user_id: text('user_id')
    .notNull()
    .references(() => user_profiles.id),
  org_id: text('org_id')
    .notNull()
    .references(() => organizations.id),
  sample_id: text('sample_id')
    .notNull()
    .references(() => sample_group_metadata.id),
  created_at: text('created_at').notNull().default(DateTime.now().toISO()),
  processing_state: text('processing_state').notNull().$type<ProcessingState>(),
  status_message: text('status_message'),
  progress_percentage: real('progress_percentage'),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  17) processed_ctd_rbr_data_values
 *  ────────────────────────────────────────────────────────────────────────────**/
export const processed_ctd_rbr_data_values = sqliteTable(
  'processed_ctd_rbr_data_values',
  {
    id: text('id').notNull().primaryKey(),
    timestamp: text('timestamp').notNull().default(DateTime.now().toISO()),
    depth: real('depth'),
    pressure: real('pressure'),
    sea_pressure: real('sea_pressure'),
    temperature: real('temperature'),
    chlorophyll_a: real('chlorophyll_a'),
    salinity: real('salinity'),
    speed_of_sound: real('speed_of_sound'),
    specific_conductivity: real('specific_conductivity'),
    processed_data_id: text('processed_data_id')
      .notNull()
      .references(() => processed_data_improved.id),
    user_id: text('user_id')
      .notNull()
      .references(() => user_profiles.id),
    org_id: text('org_id')
      .notNull()
      .references(() => organizations.id),
    sample_id: text('sample_id')
      .notNull()
      .references(() => sample_group_metadata.id),
    depth_unit: text('depth_unit'),
    pressure_unit: text('pressure_unit'),
    sea_pressure_unit: text('sea_pressure_unit'),
    temperature_unit: text('temperature_unit'),
    chlorophyll_a_unit: text('chlorophyll_a_unit'),
    salinity_unit: text('salinity_unit'),
    speed_of_sound_unit: text('speed_of_sound_unit'),
    specific_conductivity_unit: text('specific_conductivity'),
  }
);

/** ─────────────────────────────────────────────────────────────────────────────
 *  18) processed_nutrient_ammonia_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export const processed_nutrient_ammonia_data = sqliteTable(
  'processed_nutrient_ammonia_data',
  {
    id: text('id').notNull().primaryKey().default(uuidv4()),
    processed_data_id: text('processed_data_id')
      .notNull()
      .references(() => processed_data_improved.id),
    user_id: text('user_id')
      .notNull()
      .references(() => user_profiles.id),
    org_id: text('org_id')
      .notNull()
      .references(() => organizations.id),
    sample_id: text('sample_id')
      .notNull()
      .references(() => sample_group_metadata.id),
    ammonia: real('ammonia').notNull(),
    ammonium: real('ammonium').notNull(),
  }
);

/** ─────────────────────────────────────────────────────────────────────────────
 *  19) processed_kraken_uniq_report
 *  ────────────────────────────────────────────────────────────────────────────**/
export const processed_kraken_uniq_report = sqliteTable(
  'processed_kraken_uniq_report',
  {
    id: text('id').notNull().primaryKey().default(uuidv4()),
    percentage: real('percentage').notNull(),
    reads: integer('reads').notNull(),
    tax_reads: integer('tax_reads').notNull(),
    kmers: integer('kmers').notNull(),
    duplication: real('duplication').notNull(),
    coverage: real('coverage').notNull(),
    tax_id: integer('tax_id').notNull(),
    rank: text('rank').notNull(),
    tax_name: text('tax_name').notNull(),
    parent_id: text('parent_id'),
    children_ids: text('children_ids'),
    processed_data_id: text('processed_data_id')
      .notNull()
      .references(() => processed_data_improved.id),
    user_id: text('user_id')
      .notNull()
      .references(() => user_profiles.id),
    org_id: text('org_id')
      .notNull()
      .references(() => organizations.id),
    sample_id: text('sample_id')
      .notNull()
      .references(() => sample_group_metadata.id),
    e_score: real('e_score').notNull(),
  }
);

/** ─────────────────────────────────────────────────────────────────────────────
 *  20) raw_data_improved
 *  ────────────────────────────────────────────────────────────────────────────**/
export const raw_data_improved = sqliteTable('raw_data_improved', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  data_type: text('data_type').notNull(),
  user_id: text('user_id').notNull(),
  org_id: text('org_id').notNull(),
  sample_id: text('sample_id').notNull(),
  created_at: text('created_at').notNull().default(DateTime.now().toISO()),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  21) processed_ctd_rbr_data_values
 *  ────────────────────────────────────────────────────────────────────────────**/
export const raw_ctd_rbr_data_values = sqliteTable('raw_ctd_rbr_data_values', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  timestamp: text('timestamp').notNull().default(DateTime.now().toISO()),
  depth: real('depth'),
  pressure: real('pressure'),
  sea_pressure: real('sea_pressure'),
  temperature: real('temperature'),
  chlorophyll_a: real('chlorophyll_a'),
  salinity: real('salinity'),
  speed_of_sound: real('speed_of_sound'),
  specific_conductivity: real('specific_conductivity'),
  raw_data_id: text('raw_data_id')
    .notNull()
    .references(() => raw_data_improved.id),
  user_id: text('user_id')
    .notNull()
    .references(() => user_profiles.id),
  org_id: text('org_id')
    .notNull()
    .references(() => organizations.id),
  sample_id: text('sample_id')
    .notNull()
    .references(() => sample_group_metadata.id),
  depth_unit: text('depth_unit'),
  pressure_unit: text('pressure_unit'),
  sea_pressure_unit: text('sea_pressure_unit'),
  temperature_unit: text('temperature_unit'),
  chlorophyll_a_unit: text('chlorophyll_a_unit'),
  salinity_unit: text('salinity_unit'),
  speed_of_sound_unit: text('speed_of_sound_unit'),
  specific_conductivity_unit: text('specific_conductivity'),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  22) raw_nutrient_ammonia_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export const raw_nutrient_ammonia_data = sqliteTable(
  'raw_nutrient_ammonia_data',
  {
    id: text('id').notNull().primaryKey().default(uuidv4()),
    ammonia: real('ammonia').notNull(),
    raw_data_id: text('raw_data_id').notNull(),
    sample_id: text('sample_id').notNull(),
    org_id: text('org_id').notNull(),
    user_id: text('user_id'),
  }
);

/** ─────────────────────────────────────────────────────────────────────────────
 *  23) raw_fastq_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export const raw_fastq_data = sqliteTable('raw_fastq_data', {
  id: text('id').notNull().primaryKey().default(uuidv4()),
  feature_id: text('feature_id').notNull(),
  sequence: text('sequence').notNull(),
  quality: text('quality').notNull(),
  run_id: text('run_id').notNull(),
  read: integer('read').notNull(),
  ch: integer('ch').notNull(),
  start_time: text('start_time').notNull().$type<DateTime>(),
  sample_id_fastq: text('sample_id_fastq').notNull(),
  barcode: text('barcode').notNull(),
  barcode_alias: text('barcode_alias').notNull(),
  parent_read_id: text('parent_read_id').notNull(),
  basecall_model_version_id: text('basecall_model_version_id').notNull(),
  quality_median: real('quality_median').notNull(),
  flow_cell_id: text('flow_cell_id').notNull(),
  protocol_group_id: text('protocol_group_id').notNull(),
  raw_data_id: text('raw_data_id')
    .notNull()
    .references(() => raw_data_improved.id),
  user_id: text('user_id')
    .notNull()
    .references(() => user_profiles.id),
  org_id: text('org_id')
    .notNull()
    .references(() => organizations.id),
  sample_id: text('sample_id')
    .notNull()
    .references(() => sample_group_metadata.id),
  sync_flag: integer('sync_flag').$type<boolean>(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  24) processed_kraken_uniq_outfile
 *  ────────────────────────────────────────────────────────────────────────────**/
export const processed_kraken_uniq_stdout = sqliteTable(
  'processed_kraken_uniq_stdout',
  {
    id: text('id').notNull().primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user_profiles.id),
    org_id: text('org_id')
      .notNull()
      .references(() => organizations.id),
    sample_id: text('sample_id')
      .notNull()
      .references(() => sample_group_metadata.id),
    processed_data_id: text('processed_data_id')
      .notNull()
      .references(() => processed_data_improved.id),
    classified: integer('classified').notNull().$type<boolean>(),
    feature_id: integer('feature_id').notNull(),
    tax_id: integer('tax_id').notNull(),
    read_length: integer('read_length').notNull(),
    hit_data: text('hit_data').notNull(),
  }
);

export const taxdb_pr2 = sqliteTable('taxdb_pr2', {
  id: text('id').notNull().primaryKey(),
  parent_id: integer('parent_id', { mode: 'number' }).notNull(),
  rank: text('rank').notNull().$type<TaxonomicRank>(),
  tax_name: text('tax_name').notNull(),
});

export const DrizzleSchema = {
  role_permissions,
  user_roles,
  organizations,
  user_profiles,
  sample_locations,
  sample_group_metadata,
  license_keys,
  file_nodes,
  external_database_scar_locations,
  organization_settings,
  external_database_penguin_data,
  user_settings,
  processed_ctd_rbr_data_values,
  processed_kraken_uniq_report,
  processed_nutrient_ammonia_data,
  processed_data_improved,
  processed_kraken_uniq_stdout,
  raw_ctd_rbr_data_values,
  raw_nutrient_ammonia_data,
  raw_fastq_data,
  raw_data_improved,
  taxdb_pr2,
};
export default DrizzleSchema;

export const DrizzleConstants = {
  DataType,
  ProcessingState,
  ProximityCategory,
  TaxonomicRank,
};
