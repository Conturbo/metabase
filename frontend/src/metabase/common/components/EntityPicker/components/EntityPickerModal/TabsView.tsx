import { Icon, Tabs } from "metabase/ui";
import type { SearchModelType } from "metabase-types/api";

import type { EntityTab, TypeWithModel } from "../../types";
import {
  EntityPickerSearchResults,
  EntityPickerSearchTab,
} from "../EntityPickerSearch";

export const TabsView = <
  Id,
  Model extends SearchModelType,
  Item extends TypeWithModel<Id, Model>,
>({
  tabs,
  onItemSelect,
  searchQuery,
  searchResults,
  selectedItem,
}: {
  tabs: [EntityTab<Model>, ...EntityTab<Model>[]];
  onItemSelect: (item: Item) => void;
  searchQuery: string;
  searchResults: Item[] | null;
  selectedItem: Item | null;
}) => {
  const hasSearchTab = !!searchQuery;
  const defaultTab = hasSearchTab ? { model: "search" } : tabs[0];

  return (
    <Tabs
      defaultValue={defaultTab.model}
      style={{
        flexGrow: 1,
        height: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Tabs.List px="1rem">
        {tabs.map(tab => {
          const { model, icon, displayName } = tab;

          return (
            <Tabs.Tab
              key={model}
              value={displayName}
              icon={<Icon name={icon} />}
            >
              {displayName}
            </Tabs.Tab>
          );
        })}
        {hasSearchTab && (
          <EntityPickerSearchTab
            searchResults={searchResults}
            searchQuery={searchQuery}
          />
        )}
      </Tabs.List>

      {tabs.map(tab => {
        const { displayName, model } = tab;

        return (
          <Tabs.Panel
            key={model}
            value={displayName}
            style={{
              flexGrow: 1,
              height: 0,
            }}
          >
            {tab.element}
          </Tabs.Panel>
        );
      })}
      {hasSearchTab && (
        <Tabs.Panel
          key="search"
          value="search"
          style={{
            flexGrow: 1,
            height: 0,
          }}
        >
          <EntityPickerSearchResults
            searchResults={searchResults}
            onItemSelect={onItemSelect}
            selectedItem={selectedItem}
          />
        </Tabs.Panel>
      )}
    </Tabs>
  );
};
