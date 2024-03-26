import type {
  CollectionId,
  SearchListQuery,
  SearchModelType,
  SearchResult,
} from "metabase-types/api";

import type {
  EntityPickerModalOptions,
  ListProps,
  TypeWithModel,
} from "../EntityPicker";

export type CollectionPickerModel = Extract<SearchModelType, "collection">;

export type CollectionPickerItem = TypeWithModel<
  CollectionId,
  CollectionPickerModel
> &
  Pick<Partial<SearchResult>, "description" | "can_write"> & {
    location?: string | null;
    effective_location?: string | null;
    is_personal?: boolean;
  };

export type CollectionPickerOptions = EntityPickerModalOptions & {
  showPersonalCollections?: boolean;
  showRootCollection?: boolean;
  namespace?: "snippets";
};

export type CollectionItemListProps = ListProps<
  CollectionId,
  CollectionPickerModel,
  CollectionPickerItem,
  SearchListQuery,
  CollectionPickerOptions
>;
