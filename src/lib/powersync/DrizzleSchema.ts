import {
    text,
    integer,
    real,
    sqliteTable
} from "drizzle-orm/sqlite-core";
import {v4 as uuidv4} from "uuid";
import {DateTime} from "luxon";
import {ProximityCategory, TaxonomicRank} from "../types";

/** ─────────────────────────────────────────────────────────────────────────────
 *  2) organizations
 *  ────────────────────────────────────────────────────────────────────────────**/
export const organizations = sqliteTable("organizations", {
    id: text("id").notNull().primaryKey().default(uuidv4()),
    name: text("name").notNull(),
    created_at: text("created_at").default(DateTime.now().toISO()).notNull(),
    org_short_id: text("org_short_id").notNull().default('ZZZZ'),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  3) user_profiles
 *     - The metadata shows "id" repeated (once referencing `users.id` and again
 *       marked as PK). Drizzle doesn't allow `.references(...)` and `.primaryKey()`
 *       on the same column directly, so we combine them carefully.
 *  ────────────────────────────────────────────────────────────────────────────**/
export const user_profiles = sqliteTable("user_profiles", {
    // Single "id" column that is both the PK and references "users.id"
    id: text("id").notNull().primaryKey(),
    organization_id: text("organization_id")
        .references(() => organizations.id),
    created_at: text("created_at").default(DateTime.now().toISO()).notNull(),
    user_role: text("user_role" /* user-defined type */).notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  4) sample_locations
 *  ────────────────────────────────────────────────────────────────────────────**/
export const sample_locations = sqliteTable("sample_locations", {
    id: text("id").notNull().primaryKey().default(uuidv4()),
    label: text("label").notNull(),
    lat: real("lat").notNull(),
    long: real("long").notNull(),
    is_enabled: real("is_enabled").notNull(),
    char_id: text("char_id").notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  5) sample_group_metadata
 *  ────────────────────────────────────────────────────────────────────────────**/
export const sample_group_metadata = sqliteTable("sample_group_metadata", {
    id: text("id").notNull().primaryKey().default(uuidv4()),
    created_at: text("created_at").notNull().default(DateTime.now().toISO()),
    org_id: text("org_id").references(() => organizations.id),
    user_id: text("user_id").references(() => user_profiles.id),
    human_readable_sample_id: text("human_readable_sample_id").notNull(),
    collection_date: text("collection_date").notNull(),
    storage_folder: text("storage_folder").notNull(),
    collection_datetime_utc: text("collection_datetime_utc"),
    loc_id: text("loc_id").notNull().references(() => sample_locations.id),
    latitude_recorded: real("latitude_recorded"),
    longitude_recorded: real("longitude_recorded"),
    notes: text("notes"),
    updated_at: text("updated_at").notNull(),
    proximity_category: text("proximity_category").$type<ProximityCategory>(),
    excluded: integer("excluded").notNull(),
    penguin_count: integer("penguin_count"),
    penguin_present: integer("penguin_present").notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  7) file_nodes
 *  ────────────────────────────────────────────────────────────────────────────**/
export const file_nodes = sqliteTable("file_nodes", {
    id: text("id").notNull().primaryKey().default(uuidv4()),
    org_id: text("org_id").notNull().references(() => organizations.id),
    parent_id: text("parent_id"),
    name: text("name").notNull(),
    type: text("type").notNull(),
    created_at: text("created_at").notNull().default(DateTime.now().toISO()),
    updated_at: text("updated_at").notNull().default(DateTime.now().toISO()),
    version: integer("version").notNull().default(1),
    sample_group_id: text("sample_group_id").references(() => sample_group_metadata.id),
    droppable: integer("droppable").notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  8) license_keys
 *  ────────────────────────────────────────────────────────────────────────────**/
export const license_keys = sqliteTable("license_keys", {
    id: text("id").notNull().primaryKey().default(uuidv4()),
    organization_id: text("organization_id").references(() => organizations.id),
    key: text("key").notNull().default(uuidv4()),
    is_active: integer("is_active").default(1),
    created_at: text("created_at").default(DateTime.now().toISO()),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  9) processed_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export const processed_data = sqliteTable("processed_data", {
    key: text("key").notNull().unique(),
    id: text("id").notNull().primaryKey(),
    config_id: text("config_id").notNull(),
    data: text("data").notNull(),
    raw_file_paths: text("raw_file_paths").notNull(),
    processed_path: text("processed_path"),
    status: text("status").notNull(),
    metadata: text("metadata"),
    sample_id: text("sample_id").references(() => sample_group_metadata.id),
    human_readable_sample_id: text("human_readable_sample_id"),
    org_short_id: text("org_short_id"),
    org_id: text("org_id").references(() => organizations.id),
    process_function_name: text("process_function_name"),
    processed_file_paths: text("processed_file_paths"),
    timestamp: integer("timestamp").notNull().default(Date.now()),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  10) role_permissions
 *  ────────────────────────────────────────────────────────────────────────────**/
export const role_permissions = sqliteTable("role_permissions", {
    id: real("id").notNull().primaryKey(),
    role: text("role" /* user-defined enum */).notNull(),
    permission: text("permission" /* user-defined enum */).notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  11) user_roles
 *  ────────────────────────────────────────────────────────────────────────────**/
export const user_roles = sqliteTable("user_roles", {
    id: real("id").notNull().primaryKey(),
    user_id: text("user_id").notNull().references(() => user_profiles.id),
    role: text("role" /* user-defined enum */).notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  12) scar_locations
 *  ────────────────────────────────────────────────────────────────────────────**/
export const scar_locations = sqliteTable("scar_locations", {
    id: real("id").notNull().primaryKey(),
    narrative: text("narrative").notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  13) penguin_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export const penguin_data = sqliteTable("penguin_data", {
    id: real("id").notNull().primaryKey(),
    penguin_count: text("penguin_count").notNull(),
    day: text("day"),
    month: text("month"),
    year: text("year").notNull(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  13) organization_settings
 *  ────────────────────────────────────────────────────────────────────────────**/
export const organization_settings = sqliteTable("organization_settings", {
    id: real("id").notNull().primaryKey(),
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  13) user_settings
 *  ────────────────────────────────────────────────────────────────────────────**/
export const user_settings = sqliteTable("user_settings", {
    id: real("id").primaryKey(),
    user_id:text("user_id").notNull().references(() => user_profiles.id),
    taxonomic_starburst_max_rank: text("taxonomic_starburst_max_rank").notNull().$type<TaxonomicRank>(),
    taxonomic_starburst_min_rank: text("taxonomic_starburst_min_rank").notNull().$type<TaxonomicRank>(),
    globe_datapoint_poles: integer("globe_datapoint_poles").notNull(),
    globe_datapoint_color: text("globe_datapoint_color").notNull(),
    globe_datapoint_diameter: text("globe_datapoint_diameter").notNull(),
});

export const DrizzleSchema = {
    role_permissions,
    user_roles,
    organizations,
    user_profiles,
    sample_locations,
    sample_group_metadata,
    processed_data,
    license_keys,
    file_nodes,
    scar_locations,
    penguin_data,
    user_settings,
}
