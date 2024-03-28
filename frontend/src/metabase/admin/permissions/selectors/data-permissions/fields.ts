import _ from "underscore";

import { getNativePermissionDisabledTooltip } from "metabase/admin/permissions/selectors/data-permissions/shared";
import {
  getSchemasPermission,
  getFieldsPermission,
  getNativePermission,
} from "metabase/admin/permissions/utils/graph";
import {
  PLUGIN_ADMIN_PERMISSIONS_TABLE_FIELDS_ACTIONS,
  PLUGIN_ADMIN_PERMISSIONS_TABLE_FIELDS_OPTIONS,
  PLUGIN_ADMIN_PERMISSIONS_TABLE_FIELDS_POST_ACTION,
  PLUGIN_ADVANCED_PERMISSIONS,
  PLUGIN_FEATURE_LEVEL_PERMISSIONS,
} from "metabase/plugins";
import type Database from "metabase-lib/v1/metadata/Database";
import type { Group, GroupsPermissions } from "metabase-types/api";

import { DATA_PERMISSION_OPTIONS } from "../../constants/data-permissions";
import { UNABLE_TO_CHANGE_ADMIN_PERMISSIONS } from "../../constants/messages";
import type {
  TableEntityId,
  PermissionSectionConfig,
  DataPermissionValue,
} from "../../types";
import { DataPermission, DataPermissionType } from "../../types";
import {
  getPermissionWarning,
  getPermissionWarningModal,
  getControlledDatabaseWarningModal,
  getRevokingAccessToAllTablesWarningModal,
} from "../confirmations";

const buildAccessPermission = (
  entityId: TableEntityId,
  groupId: number,
  isAdmin: boolean,
  permissions: GroupsPermissions,
  originalPermissions: GroupsPermissions,
  defaultGroup: Group,
  database: Database,
): PermissionSectionConfig => {
  const value = getFieldsPermission(
    permissions,
    groupId,
    entityId,
    DataPermission.VIEW_DATA,
  );

  const originalValue = getFieldsPermission(
    originalPermissions,
    groupId,
    entityId,
    DataPermission.VIEW_DATA,
  );
  const defaultGroupValue = getFieldsPermission(
    permissions,
    defaultGroup.id,
    entityId,
    DataPermission.VIEW_DATA,
  );

  const warning = getPermissionWarning(
    value,
    defaultGroupValue,
    "fields",
    defaultGroup,
    groupId,
  );

  const currDbPermissionValue = getSchemasPermission(
    permissions,
    groupId,
    entityId,
    DataPermission.VIEW_DATA,
  );

  const confirmations = (newValue: DataPermissionValue) => [
    getPermissionWarningModal(
      newValue,
      defaultGroupValue,
      "fields",
      defaultGroup,
      groupId,
    ),
    getControlledDatabaseWarningModal(currDbPermissionValue, entityId),
    getRevokingAccessToAllTablesWarningModal(
      database,
      permissions,
      groupId,
      entityId,
      newValue,
    ),
  ];

  const options = PLUGIN_ADVANCED_PERMISSIONS.addTablePermissionOptions(
    _.compact([
      DATA_PERMISSION_OPTIONS.unrestricted,
      ...PLUGIN_ADMIN_PERMISSIONS_TABLE_FIELDS_OPTIONS,
      originalValue === DATA_PERMISSION_OPTIONS.noSelfServiceDeprecated.value &&
        DATA_PERMISSION_OPTIONS.noSelfServiceDeprecated,
    ]),
    value,
  );

  return {
    permission: DataPermission.VIEW_DATA,
    type: DataPermissionType.ACCESS,
    isDisabled:
      isAdmin ||
      options.length <= 1 ||
      PLUGIN_ADVANCED_PERMISSIONS.isAccessPermissionDisabled(value, "fields"),
    disabledTooltip: isAdmin ? UNABLE_TO_CHANGE_ADMIN_PERMISSIONS : null,
    isHighlighted: isAdmin,
    value,
    warning,
    options,
    actions: PLUGIN_ADMIN_PERMISSIONS_TABLE_FIELDS_ACTIONS,
    postActions: PLUGIN_ADMIN_PERMISSIONS_TABLE_FIELDS_POST_ACTION,
    confirmations,
  };
};

const buildNativePermission = (
  entityId: TableEntityId,
  groupId: number,
  isAdmin: boolean,
  permissions: GroupsPermissions,
  accessPermissionValue: string,
): PermissionSectionConfig => {
  const { databaseId } = entityId;
  const dbValue = getNativePermission(permissions, groupId, { databaseId });
  const isControlledByDb = dbValue !== DATA_PERMISSION_OPTIONS.controlled.value;

  return {
    permission: DataPermission.CREATE_QUERIES,
    type: DataPermissionType.NATIVE,
    isDisabled: isControlledByDb,
    disabledTooltip: getNativePermissionDisabledTooltip(
      isAdmin,
      accessPermissionValue,
    ),
    isHighlighted: isAdmin,
    value: getNativePermission(permissions, groupId, entityId),
    options: _.compact([
      isControlledByDb && DATA_PERMISSION_OPTIONS.queryBuilderAndNative,
      DATA_PERMISSION_OPTIONS.queryBuilder,
      DATA_PERMISSION_OPTIONS.no,
    ]),
  };
};

export const buildFieldsPermissions = (
  entityId: TableEntityId,
  groupId: number,
  isAdmin: boolean,
  permissions: GroupsPermissions,
  originalPermissions: GroupsPermissions,
  defaultGroup: Group,
  database: Database,
): PermissionSectionConfig[] => {
  const accessPermission = buildAccessPermission(
    entityId,
    groupId,
    isAdmin,
    permissions,
    originalPermissions,
    defaultGroup,
    database,
  );

  const nativePermission = buildNativePermission(
    entityId,
    groupId,
    isAdmin,
    permissions,
    accessPermission.value,
  );

  return [
    accessPermission,
    nativePermission,
    ...PLUGIN_FEATURE_LEVEL_PERMISSIONS.getFeatureLevelDataPermissions(
      entityId,
      groupId,
      isAdmin,
      permissions,
      accessPermission.value,
      defaultGroup,
      "fields",
    ),
  ];
};
