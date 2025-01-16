import {DataType, DrizzleSchema} from '../lib/powersync/DrizzleSchema.ts'
import { type InferSelectModel } from 'drizzle-orm'

export type Organizations = InferSelectModel<typeof DrizzleSchema.organizations>
export type UserProfiles = InferSelectModel<typeof DrizzleSchema.user_profiles>
export type SampleLocations = InferSelectModel<typeof DrizzleSchema.sample_locations>
export type SampleGroupMetadata = InferSelectModel<typeof DrizzleSchema.sample_group_metadata>
export type FileNodes = InferSelectModel<typeof DrizzleSchema.file_nodes>
export type LicenseKeys = InferSelectModel<typeof DrizzleSchema.license_keys>
export type RolePermissions = InferSelectModel<typeof DrizzleSchema.role_permissions>
export type UserRoles = InferSelectModel<typeof DrizzleSchema.user_profiles>
export type ExternalDatabaseScarLocations = InferSelectModel<typeof DrizzleSchema.external_database_scar_locations>
export type OrganizationSettings = InferSelectModel<typeof DrizzleSchema.organization_settings>
export type UserSettings = InferSelectModel<typeof DrizzleSchema.user_settings>
export type ProcessedDataImproved = InferSelectModel<typeof DrizzleSchema.processed_data_improved>
export type ProcessedCtdRbrDataValues = InferSelectModel<typeof DrizzleSchema.processed_ctd_rbr_data_values>
export type ProcessedNutrientAmmoniaData = InferSelectModel<typeof DrizzleSchema.processed_nutrient_ammonia_data>
export type ProcessedKrakenUniqReport = InferSelectModel<typeof DrizzleSchema.processed_kraken_uniq_report>
export type RawDataImproved = InferSelectModel<typeof DrizzleSchema.raw_data_improved>
export type RawCtdRbrDataValues = InferSelectModel<typeof DrizzleSchema.raw_ctd_rbr_data_values>
export type RawNutrientAmmoniaData = InferSelectModel<typeof DrizzleSchema.raw_nutrient_ammonia_data>
export type RawFastqData = InferSelectModel<typeof DrizzleSchema.raw_fastq_data>
export type ProcessedKrakenUniqStdout = InferSelectModel<typeof DrizzleSchema.processed_kraken_uniq_stdout>
export type DetailedData =
    | { dataType: DataType.CTD; data: ProcessedCtdRbrDataValues[] }
    | { dataType: DataType.NutrientAmmonia; data: ProcessedNutrientAmmoniaData[] }
    | { dataType: DataType.Sequence; data: ProcessedKrakenUniqReport[] };