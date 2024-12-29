export enum UserRole {
    Admin = 'admin',
    Lead = 'lead',
    Researcher = 'researcher',
    Viewer = 'viewer',
}

export enum PoleshiftPermissions {
    AddUser = 'organizations.add_user',
    RemoveUser = 'organizations.remove_user',
    ViewUser = 'organizations.view_user',
    ModifyUser = 'organizations.modify_user',
    DeleteSampleGroup = 'sample_groups.delete',
    CreateSampleGroup = 'sample_groups.create',
    ModifySampleGroup = 'sample_groups.modify',
    ShareSampleGroup = 'sample_groups.share',
}

export enum FileNodeType {
    Folder = 'folder',
    SampleGroup = 'sampleGroup',
    Container = 'container',
}

export enum ProximityCategory {
    Close = 'Close',
    Far1 = 'Far1',
    Far2 = 'Far2'
}

export enum TaxonomicRank {
    Root = 'Root',
    Domain = 'Domain',
    Supergroup = 'Supergroup',
    Division = 'Division',
    Subdivision = 'Subdivision',
    Class = 'Class',
    Order = 'Order',
    Family = 'Family',
    Genus = 'Genus',
    Species = 'Species',
    Assembly = 'Assembly',
    Sequence = 'Sequence',
}

export enum TaxonomicRankAndUnclassified {
    Root = 'Root',
    Domain = 'Domain',
    Supergroup = 'Supergroup',
    Division = 'Division',
    Subdivision = 'Subdivision',
    Class = 'Class',
    Order = 'Order',
    Family = 'Family',
    Genus = 'Genus',
    Species = 'Species',
    Assembly = 'Assembly',
    Sequence = 'Sequence',
    Unclassified = 'Unclassified',
}

export enum DataType {
    CTD = 'ctd',
    Sequence = 'sequence',
    NutrientAmmonia = 'nutrient_ammonia',
}

export enum TauriProcessingFunctions {
    CTD = 'handle_ctd_data',
    Sequence = 'handle_sequence_data',
    NutrientAmmonia = 'handle_nutrient_ammonia',
    RangeFinder = 'handle_range_finder',
}

export enum ProcessingState {
    Initiated = 'initiated',
    Processing = 'processing',
    Complete = 'complete',
    Error = 'error',
    Saving = 'saving',
}
