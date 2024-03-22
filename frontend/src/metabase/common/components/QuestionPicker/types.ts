import type {
  CardId,
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

export type QuestionPickerItem = TypeWithModel<
  CollectionId | CardId,
  SearchModelType
> &
  Pick<Partial<SearchResult>, "description" | "can_write"> & {
    location?: string | null;
    effective_location?: string | null;
    is_personal?: boolean;
    collection_id?: CollectionId;
  };

export type QuestionPickerOptions = EntityPickerModalOptions & {
  showPersonalCollections?: boolean;
  showRootCollection?: boolean;
};

export type QuestionItemListProps = ListProps<
  CollectionId | CardId,
  SearchModelType,
  QuestionPickerItem,
  SearchListQuery,
  QuestionPickerOptions
>;
