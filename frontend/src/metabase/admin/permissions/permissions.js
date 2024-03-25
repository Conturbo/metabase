import { assocIn, merge } from "icepick";
import { push } from "react-router-redux";
import { t } from "ttag";

import {
  inferAndUpdateEntityPermissions,
  updateFieldsPermission,
  updateNativePermission,
  updateSchemasPermission,
  updateTablesPermission,
  updatePermission,
} from "metabase/admin/permissions/utils/graph";
import { getGroupFocusPermissionsUrl } from "metabase/admin/permissions/utils/urls";
import Group from "metabase/entities/groups";
import Tables from "metabase/entities/tables";
import * as MetabaseAnalytics from "metabase/lib/analytics";
import {
  createAction,
  createThunkAction,
  handleActions,
  combineReducers,
} from "metabase/lib/redux";
import { PLUGIN_DATA_PERMISSIONS } from "metabase/plugins";
import { getMetadataWithHiddenTables } from "metabase/selectors/metadata";
import { CollectionsApi, PermissionsApi } from "metabase/services";

import { trackPermissionChange } from "./analytics";
import { isDatabaseEntityId } from "./utils/data-entity-id";

const INITIALIZE_DATA_PERMISSIONS =
  "metabase/admin/permissions/INITIALIZE_DATA_PERMISSIONS";
export const initializeDataPermissions = createThunkAction(
  INITIALIZE_DATA_PERMISSIONS,
  () => async dispatch => {
    await Promise.all([
      dispatch(loadDataPermissions()),
      dispatch(Group.actions.fetchList()),
    ]);
  },
);

export const LOAD_DATA_PERMISSIONS =
  "metabase/admin/permissions/LOAD_DATA_PERMISSIONS";
export const loadDataPermissions = createThunkAction(
  LOAD_DATA_PERMISSIONS,
  () => async () => PermissionsApi.graph(),
);

export const RESTORE_LOADED_PERMISSIONS =
  "metabase/admin/permissions/RESTORE_LOADED_PERMISSIONS";

export const restoreLoadedPermissions = createThunkAction(
  RESTORE_LOADED_PERMISSIONS,
  () => async (dispatch, getState) => {
    const state = getState();
    const groups = state.admin.permissions.originalDataPermissions;
    const revision = state.admin.permissions.dataPermissionsRevision;
    dispatch({ type: LOAD_DATA_PERMISSIONS, payload: { groups, revision } });
  },
);

export const LOAD_DATA_PERMISSIONS_FOR_GROUP =
  "metabase/admin/permissions/LOAD_DATA_PERMISSIONS_FOR_GROUP";

export const LOAD_DATA_PERMISSIONS_FOR_DB =
  "metabase/admin/permissions/LOAD_DATA_PERMISSIONS_FOR_GROUP";

const INITIALIZE_COLLECTION_PERMISSIONS =
  "metabase/admin/permissions/INITIALIZE_COLLECTION_PERMISSIONS";
export const initializeCollectionPermissions = createThunkAction(
  INITIALIZE_COLLECTION_PERMISSIONS,
  namespace => async dispatch => {
    await Promise.all([
      dispatch(loadCollectionPermissions(namespace)),
      dispatch(Group.actions.fetchList()),
    ]);
  },
);

const LOAD_COLLECTION_PERMISSIONS =
  "metabase/admin/permissions/LOAD_COLLECTION_PERMISSIONS";
export const loadCollectionPermissions = createThunkAction(
  LOAD_COLLECTION_PERMISSIONS,
  namespace => async () => {
    const params = namespace != null ? { namespace } : {};
    return CollectionsApi.graph(params);
  },
);

export const GRANULATE_DATABASE_TABLE_PERMISSIONS =
  "metabase/admin/permissions/GRANULATE_DATABASE_TABLE_PERMISSIONS";
export const granulateDatabasePermissions = createThunkAction(
  GRANULATE_DATABASE_TABLE_PERMISSIONS,
  (groupId, entityId, permission, value, defaultValue) => dispatch => {
    // HACK: updatePermission fn sets entities of controlled values (schemas in this case
    // to the previously set value of the parent (database in this case). if the db perm
    // value is set to something other than restrictied before changing to controlled, the
    // table's view data dropdowns will get locked in an unchangable state (e.g. blocked, impersonated)
    if (value === "controlled") {
      dispatch(
        updateDataPermission({
          groupId,
          permission,
          value: defaultValue,
          entityId,
        }),
      );
    }

    dispatch(updateDataPermission({ groupId, permission, value, entityId }));

    dispatch(push(getGroupFocusPermissionsUrl(groupId, entityId)));
  },
);

export const UPDATE_DATA_PERMISSION =
  "metabase/admin/permissions/UPDATE_DATA_PERMISSION";
export const updateDataPermission = createThunkAction(
  UPDATE_DATA_PERMISSION,
  ({ groupId, permission: permissionInfo, value, entityId, view }) => {
    return (dispatch, getState) => {
      if (isDatabaseEntityId(entityId)) {
        dispatch(
          Tables.actions.fetchList({
            dbId: entityId.databaseId,
            include_hidden: true,
            remove_inactive: true,
          }),
        );
      }

      const metadata = getMetadataWithHiddenTables(getState(), null);
      if (permissionInfo.postActions) {
        const action = permissionInfo.postActions?.[value]?.(
          entityId,
          groupId,
          view,
          value,
        );
        if (action) {
          dispatch(action);
          return;
        }
      }

      trackPermissionChange(
        entityId,
        permissionInfo.permission,
        permissionInfo.type === "create-queries",
        value,
      );

      return { groupId, permissionInfo, value, metadata, entityId };
    };
  },
);

export const SAVE_DATA_PERMISSIONS =
  "metabase/admin/permissions/data/SAVE_DATA_PERMISSIONS";
export const saveDataPermissions = createThunkAction(
  SAVE_DATA_PERMISSIONS,
  () => async (_dispatch, getState) => {
    MetabaseAnalytics.trackStructEvent("Permissions", "save");
    const { dataPermissions, dataPermissionsRevision } =
      getState().admin.permissions;

    const extraData =
      PLUGIN_DATA_PERMISSIONS.permissionsPayloadExtraSelectors.reduce(
        (data, selector) => {
          return {
            ...data,
            ...selector(getState()),
          };
        },
        {},
      );

    const permissionsGraph = {
      groups: dataPermissions,
      revision: dataPermissionsRevision,
      ...extraData,
    };

    return await PermissionsApi.updateGraph(permissionsGraph);
  },
);

const UPDATE_COLLECTION_PERMISSION =
  "metabase/admin/permissions/UPDATE_COLLECTION_PERMISSION";
export const updateCollectionPermission = createAction(
  UPDATE_COLLECTION_PERMISSION,
);

const SAVE_COLLECTION_PERMISSIONS =
  "metabase/admin/permissions/data/SAVE_COLLECTION_PERMISSIONS";
export const saveCollectionPermissions = createThunkAction(
  SAVE_COLLECTION_PERMISSIONS,
  namespace => async (_dispatch, getState) => {
    MetabaseAnalytics.trackStructEvent("Permissions", "save");
    const { collectionPermissions, collectionPermissionsRevision } =
      getState().admin.permissions;
    const result = await CollectionsApi.updateGraph({
      namespace,
      revision: collectionPermissionsRevision,
      groups: collectionPermissions,
    });
    return result;
  },
);

const CLEAR_SAVE_ERROR = "metabase/admin/permissions/CLEAR_SAVE_ERROR";
export const clearSaveError = createAction(CLEAR_SAVE_ERROR);

const savePermission = {
  next: _state => null,
  throw: (_state, { payload }) => {
    return (
      (payload && typeof payload.data === "string"
        ? payload.data
        : payload.data?.message) || t`Sorry, an error occurred.`
    );
  },
};

const saveError = handleActions(
  {
    [SAVE_DATA_PERMISSIONS]: savePermission,
    [LOAD_DATA_PERMISSIONS]: {
      next: state => null,
    },
    [SAVE_COLLECTION_PERMISSIONS]: savePermission,
    [LOAD_COLLECTION_PERMISSIONS]: {
      next: state => null,
    },
    [CLEAR_SAVE_ERROR]: { next: () => null },
  },
  null,
);

function getDecendentCollections(collection) {
  const subCollections = collection.children.filter(
    collection => !collection.is_personal,
  );
  return subCollections.concat(...subCollections.map(getDecendentCollections));
}

const dataPermissions = handleActions(
  {
    [LOAD_DATA_PERMISSIONS]: {
      next: (_state, { payload }) => payload.groups,
    },
    [LOAD_DATA_PERMISSIONS_FOR_GROUP]: {
      next: (state, { payload }) => merge(payload.groups, state),
    },
    [LOAD_DATA_PERMISSIONS_FOR_DB]: {
      next: (state, { payload }) => merge(payload.groups, state),
    },
    [SAVE_DATA_PERMISSIONS]: { next: (_state, { payload }) => payload.groups },
    [UPDATE_DATA_PERMISSION]: {
      next: (state, { payload }) => {
        if (payload == null) {
          return state;
        }

        const { value, groupId, entityId, metadata, permissionInfo } = payload;

        const database = metadata.database(entityId.databaseId);

        if (permissionInfo.type === "details") {
          return updatePermission(
            state,
            groupId,
            [entityId.databaseId, permissionInfo.type],
            value,
          );
        }

        if (permissionInfo.type === "create-queries") {
          const updateFn =
            PLUGIN_DATA_PERMISSIONS.updateNativePermission ??
            updateNativePermission;

          return updateFn(
            state,
            groupId,
            entityId,
            value,
            database,
            permissionInfo.permission,
          );
        }

        const shouldDowngradeNative = permissionInfo.type === "access";

        if (entityId.tableId != null) {
          const updatedPermissions = updateFieldsPermission(
            state,
            groupId,
            entityId,
            value,
            database,
            permissionInfo.permission,
            shouldDowngradeNative,
          );
          return inferAndUpdateEntityPermissions(
            updatedPermissions,
            groupId,
            entityId,
            database,
            permissionInfo.permission,
            shouldDowngradeNative,
          );
        } else if (entityId.schemaName != null) {
          return updateTablesPermission(
            state,
            groupId,
            entityId,
            value,
            database,
            permissionInfo.permission,
            shouldDowngradeNative,
          );
        } else {
          return updateSchemasPermission(
            state,
            groupId,
            entityId,
            value,
            database,
            permissionInfo.permission,
            shouldDowngradeNative,
          );
        }
      },
    },
  },
  null,
);

const originalDataPermissions = handleActions(
  {
    [LOAD_DATA_PERMISSIONS]: {
      next: (_state, { payload }) => payload.groups,
    },
    [LOAD_DATA_PERMISSIONS_FOR_GROUP]: {
      next: (state, { payload }) => merge(payload.groups, state),
    },
    [LOAD_DATA_PERMISSIONS_FOR_DB]: {
      next: (state, { payload }) => merge(payload.groups, state),
    },
    [SAVE_DATA_PERMISSIONS]: {
      next: (_state, { payload }) => payload.groups,
    },
  },
  null,
);

const dataPermissionsRevision = handleActions(
  {
    [LOAD_DATA_PERMISSIONS]: {
      next: (_state, { payload }) => payload.revision,
    },
    [LOAD_DATA_PERMISSIONS_FOR_GROUP]: {
      next: (state, { payload }) => payload.revision,
    },
    [LOAD_DATA_PERMISSIONS_FOR_DB]: {
      next: (state, { payload }) => payload.revision,
    },
    [SAVE_DATA_PERMISSIONS]: {
      next: (_state, { payload }) => payload.revision,
    },
  },
  null,
);

const collectionPermissions = handleActions(
  {
    [LOAD_COLLECTION_PERMISSIONS]: {
      next: (_state, { payload }) => payload.groups,
    },
    [UPDATE_COLLECTION_PERMISSION]: {
      next: (state, { payload }) => {
        const { groupId, collection, value, shouldPropagate } = payload;
        let newPermissions = assocIn(state, [groupId, collection.id], value);

        if (shouldPropagate) {
          for (const descendent of getDecendentCollections(collection)) {
            newPermissions = assocIn(
              newPermissions,
              [groupId, descendent.id],
              value,
            );
          }
        }
        return newPermissions;
      },
    },
    [SAVE_COLLECTION_PERMISSIONS]: {
      next: (_state, { payload }) => payload.groups,
    },
  },
  null,
);

const originalCollectionPermissions = handleActions(
  {
    [LOAD_COLLECTION_PERMISSIONS]: {
      next: (_state, { payload }) => payload.groups,
    },
    [SAVE_COLLECTION_PERMISSIONS]: {
      next: (_state, { payload }) => payload.groups,
    },
  },
  null,
);

const collectionPermissionsRevision = handleActions(
  {
    [LOAD_COLLECTION_PERMISSIONS]: {
      next: (_state, { payload }) => payload.revision,
    },
    [SAVE_COLLECTION_PERMISSIONS]: {
      next: (_state, { payload }) => payload.revision,
    },
  },
  null,
);

export const TOGGLE_HELP_REFERENCE =
  "metabase/admin/permissions/TOGGLE_HELP_REFERENCE";
export const toggleHelpReference = createAction(TOGGLE_HELP_REFERENCE);

export const isHelpReferenceOpen = handleActions(
  {
    [toggleHelpReference]: {
      next: state => !state,
    },
  },
  false,
);

const checkRevisionChanged = (state, { payload }) => {
  if (!state.revision) {
    return {
      revision: payload.revision,
      hasChanged: false,
    };
  } else if (state.revision === payload.revision && !state.hasChanged) {
    return state;
  } else {
    return {
      revision: payload.revision,
      hasChanged: true,
    };
  }
};

const hasRevisionChanged = handleActions(
  {
    [LOAD_DATA_PERMISSIONS]: {
      next: checkRevisionChanged,
    },
    [LOAD_DATA_PERMISSIONS_FOR_GROUP]: {
      next: checkRevisionChanged,
    },
    [LOAD_DATA_PERMISSIONS_FOR_DB]: {
      next: checkRevisionChanged,
    },
    [SAVE_DATA_PERMISSIONS]: {
      next: (state, { payload }) => ({
        revision: payload.revision,
        hasChanged: false,
      }),
    },
  },
  {
    revision: null,
    hasChanged: false,
  },
);

export default combineReducers({
  saveError,
  dataPermissions,
  originalDataPermissions,
  dataPermissionsRevision,
  collectionPermissions,
  originalCollectionPermissions,
  collectionPermissionsRevision,
  isHelpReferenceOpen,
  hasRevisionChanged,
});
