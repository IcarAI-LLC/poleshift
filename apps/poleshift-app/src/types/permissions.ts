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

export const adminPermissions: PoleshiftPermissions[] = [
  PoleshiftPermissions.AddUser,
  PoleshiftPermissions.RemoveUser,
  PoleshiftPermissions.ViewUser,
  PoleshiftPermissions.ModifyUser,
  PoleshiftPermissions.DeleteSampleGroup,
  PoleshiftPermissions.CreateSampleGroup,
  PoleshiftPermissions.ModifySampleGroup,
  PoleshiftPermissions.ShareSampleGroup,
];

export const leadPermissions: PoleshiftPermissions[] = [
  PoleshiftPermissions.AddUser,
  PoleshiftPermissions.RemoveUser,
  PoleshiftPermissions.ViewUser,
  PoleshiftPermissions.ModifyUser,
  PoleshiftPermissions.DeleteSampleGroup,
  PoleshiftPermissions.CreateSampleGroup,
  PoleshiftPermissions.ModifySampleGroup,
  PoleshiftPermissions.ShareSampleGroup,
];

export const researcherPermissions: PoleshiftPermissions[] = [
  PoleshiftPermissions.ViewUser,
  PoleshiftPermissions.CreateSampleGroup,
  PoleshiftPermissions.ModifySampleGroup,
];

export const viewerPermissions: PoleshiftPermissions[] = [];
