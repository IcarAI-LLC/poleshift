import { column, Schema, Table } from '@powersync/web';
// OR: import { column, Schema, Table } from '@powersync/react-native';

const sample_locations = new Table(
    {
        // id column (text) is automatically included
        label: column.text,
        lat: column.text,
        long: column.text,
        is_enabled: column.integer,
        char_id: column.text
    },
    { indexes: {} }
);

const license_keys = new Table(
    {
        // id column (text) is automatically included
        organization_id: column.text,
        key: column.text,
        is_active: column.integer,
        created_at: column.text
    },
    { indexes: {} }
);

const user_profiles = new Table(
    {
        // id column (text) is automatically included
        organization_id: column.text,
        user_tier: column.text,
        created_at: column.text
    },
    { indexes: {} }
);

const user_tiers = new Table(
    {
        // id column (text) is automatically included
        name: column.text
    },
    { indexes: {} }
);

const organizations = new Table(
    {
        // id column (text) is automatically included
        name: column.text,
        created_at: column.text,
        org_short_id: column.text
    },
    { indexes: {} }
);

const file_nodes = new Table(
    {
        // id column (text) is automatically included
        org_id: column.text,
        parent_id: column.text,
        name: column.text,
        type: column.text,
        created_at: column.text,
        updated_at: column.text,
        version: column.integer,
        sample_group_id: column.text,
        children: column.text,
        droppable: column.integer
    },
    { indexes: {} }
);

const processed_data = new Table(
    {
        // id column (text) is automatically included
        key: column.text,
        config_id: column.text,
        data: column.text,
        raw_file_paths: column.text,
        processed_path: column.text,
        timestamp: column.integer,
        status: column.text,
        metadata: column.text,
        sample_id: column.text,
        human_readable_sample_id: column.text,
        org_short_id: column.text,
        org_id: column.text,
        process_function_name: column.text,
        processed_file_paths: column.text
    },
    { indexes: {} }
);

const sample_group_metadata = new Table(
    {
        // id column (text) is automatically included
        created_at: column.text,
        org_id: column.text,
        user_id: column.text,
        human_readable_sample_id: column.text,
        collection_date: column.text,
        storage_folder: column.text,
        collection_datetime_utc: column.text,
        loc_id: column.text,
        latitude_recorded: column.text,
        longitude_recorded: column.text,
        notes: column.text,
        updated_at: column.text
    },
    { indexes: {} }
);

const sample_metadata = new Table(
    {
        // id column (text) is automatically included
        created_at: column.text,
        org_id: column.text,
        user_id: column.text,
        human_readable_sample_id: column.text,
        file_name: column.text,
        file_type: column.text,
        data_type: column.text,
        lat: column.real,
        long: column.real,
        status: column.text,
        processed_storage_path: column.text,
        processed_datetime_utc: column.text,
        upload_datetime_utc: column.text,
        process_function_name: column.text,
        sample_group_id: column.text,
        raw_storage_paths: column.text,
        updated_at: column.text
    },
    { indexes: {} }
);

export const AppSchema = new Schema({
    sample_locations,
    license_keys,
    user_profiles,
    user_tiers,
    organizations,
    file_nodes,
    processed_data,
    sample_group_metadata,
    sample_metadata
});

export type Database = (typeof AppSchema)['types'];
