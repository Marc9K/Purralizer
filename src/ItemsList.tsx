import { Box, Tabs, VStack } from "@chakra-ui/react";
import type { createToaster } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  createCombinedItem,
  getCombinedItems,
  updateCombinedItem,
} from "./db/operations";
import CombinedListGrid from "./components/CombinedListGrid";
import ItemsListFilters from "./components/ItemsListFilters";
import ItemsListGrid from "./components/ItemsListGrid";
import ItemsListHeader from "./components/ItemsListHeader";
import { useItemsListLogic } from "./hooks/useItemsListLogic";
import type { SortDirection } from "./hooks/useItemsListLogic";

type ItemsListProps = {
  statusToaster: ReturnType<typeof createToaster>;
};

export default function ItemsList({ statusToaster }: ItemsListProps) {
  const {
    itemsArray,
    itemsLoading,
    hasItems,
    totalItemsCount,
    searchQuery,
    setSearchQuery,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    handleFileAccept,
    handleClearDB,
    formattedTotalSpent,
    isBusy,
  } = useItemsListLogic(statusToaster);

  const showItemsSection = itemsArray.length > 0 || itemsLoading;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [combinedSearchQuery, setCombinedSearchQuery] = useState("");
  const [combinedSortField, setCombinedSortField] = useState<string[]>([
    "totalSpent",
  ]);
  const [combinedSortDirection, setCombinedSortDirection] =
    useState<SortDirection>("desc");
  const [combinedItems, setCombinedItems] = useState<
    Awaited<ReturnType<typeof getCombinedItems>>
  >([]);
  const [combinedLoading, setCombinedLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("items");
  const [editingCombinedId, setEditingCombinedId] = useState<number | null>(null);
  const [editingCombinedName, setEditingCombinedName] = useState("");

  const loadCombinedItems = () => {
    const currentSortField = (combinedSortField[0] || "totalSpent") as
      | "name"
      | "totalSpent";
    setCombinedLoading(true);
    getCombinedItems(currentSortField, combinedSortDirection)
      .then(setCombinedItems)
      .finally(() => setCombinedLoading(false));
  };

  useEffect(() => {
    loadCombinedItems();
  }, [combinedSortField, combinedSortDirection]);

  useEffect(() => {
    const handleCombinedUpdate = () => {
      loadCombinedItems();
    };
    window.addEventListener("db-update", handleCombinedUpdate);
    return () => window.removeEventListener("db-update", handleCombinedUpdate);
  }, [combinedSortField, combinedSortDirection]);

  useEffect(() => {
    if (!hasSearchQuery && editingCombinedId === null) {
      setSelectedItemIds([]);
    }
  }, [hasSearchQuery, editingCombinedId]);

  useEffect(() => {
    if (!hasSearchQuery) {
      return;
    }

    const currentItemIds = new Set(itemsArray.map((item) => item.id));
    setSelectedItemIds((prev) => {
      const filtered = prev.filter((id) => currentItemIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [itemsArray, hasSearchQuery]);

  const filteredCombinedItems = combinedItems.filter((item) =>
    item.name.toLowerCase().includes(combinedSearchQuery.toLowerCase().trim())
  );

  const handleSelectAll = () => {
    setSelectedItemIds(itemsArray.map((item) => item.id));
  };

  const handleDeselectAll = () => {
    setSelectedItemIds([]);
  };

  const handleSelectionChange = (itemId: number, isSelected: boolean) => {
    setSelectedItemIds((prev) => {
      if (isSelected) {
        return prev.includes(itemId) ? prev : [...prev, itemId];
      }
      return prev.filter((id) => id !== itemId);
    });
  };

  const handleEditCombinedItems = (details: {
    combinedItemId: number;
    name: string;
    itemIds: number[];
  }) => {
    const currentItemIds = new Set(itemsArray.map((item) => item.id));
    setSelectedItemIds(
      details.itemIds.filter((id) => currentItemIds.has(id))
    );
    setEditingCombinedId(details.combinedItemId);
    setEditingCombinedName(details.name);
    setActiveTab("items");
  };

  const resetEditingCombined = () => {
    setEditingCombinedId(null);
    setEditingCombinedName("");
    setSelectedItemIds([]);
  };

  const handleSaveCombinedEdit = async () => {
    console.log("updating combined item", editingCombinedId, editingCombinedName, selectedItemIds);
    if (editingCombinedId === null) return;
    try {
      await updateCombinedItem(
        editingCombinedId,
        editingCombinedName,
        selectedItemIds
      );
      resetEditingCombined();
      window.dispatchEvent(new Event("db-update"));
    } catch (err) {
      statusToaster.create({
        title: "Update failed",
        description: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    }
  };

  const handleCombineConfirm = async (name: string) => {
    if (!name.trim() || selectedItemIds.length === 0) return;
    try {
      await createCombinedItem(name.trim(), selectedItemIds);
      setSelectedItemIds([]);
      window.dispatchEvent(new Event("db-update"));
    } catch (err) {
      statusToaster.create({
        title: "Combine failed",
        description: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    }
  };

  const handleCombineClick = async () => {
    if (selectedItemIds.length === 0) {
      return;
    }
    const name = window.prompt("Name for combined item");
    if (!name || !name.trim()) {
      return;
    }
    await handleCombineConfirm(name);
  };

  return (
    <Box p={8} className="widened">
      <VStack gap={4} className="widened-vertical bg-vstack">
        <ItemsListHeader
          hasItems={hasItems}
          isBusy={isBusy}
          totalSpentDisplay={formattedTotalSpent}
          onFileAccept={handleFileAccept}
          onClearDatabase={handleClearDB}
          showSelectionControls={hasSearchQuery || editingCombinedId !== null}
          isCombinedTab={activeTab === "combined"}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onCombineClick={handleCombineClick}
          combineDisabled={selectedItemIds.length === 0}
          editingCombinedId={editingCombinedId}
          editingCombinedName={editingCombinedName}
          onEditingCombinedNameChange={setEditingCombinedName}
          onSaveCombinedEdit={handleSaveCombinedEdit}
          onCancelCombinedEdit={resetEditingCombined}
          selectAllDisabled={
            itemsArray.length === 0 ||
            selectedItemIds.length === itemsArray.length
          }
          deselectAllDisabled={selectedItemIds.length === 0}
        />
        {showItemsSection && (
          <VStack
            gap={4}
            align="stretch"
            mt={8}
            className="widened-vertical "
          >
            <ItemsListFilters
              itemsCount={itemsArray.length}
              totalItemsCount={totalItemsCount}
              itemsLoading={itemsLoading}
              searchQuery={
                activeTab === "items" ? searchQuery : combinedSearchQuery
              }
              onSearchQueryChange={
                activeTab === "items" ? setSearchQuery : setCombinedSearchQuery
              }
              searchPlaceholder={
                activeTab === "items"
                  ? "Search items by name..."
                  : "Search combined items by name..."
              }
              isCombinedTab={activeTab === "combined"}
              sortField={activeTab === "items" ? sortField : combinedSortField}
              onSortFieldChange={
                activeTab === "items" ? setSortField : setCombinedSortField
              }
              sortDirection={
                activeTab === "items" ? sortDirection : combinedSortDirection
              }
              onSortDirectionChange={
                activeTab === "items"
                  ? setSortDirection
                  : setCombinedSortDirection
              }
            />
            <Tabs.Root
              value={activeTab}
              onValueChange={(details) => setActiveTab(details.value)}
              className=""
            >
              <Tabs.List className="">
                <Tabs.Trigger
                  value="items"
                  width="6rem"
                  justifyContent="center"
                >
                  Items
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="combined"
                  width="6rem"
                  justifyContent="center"
                >
                  Combined
                </Tabs.Trigger>
                <Tabs.Indicator />
              </Tabs.List>
              <Tabs.Content value="items" className="widened ">
                <ItemsListGrid
                  items={itemsArray}
                  loading={itemsLoading}
                  showSelectionControls={hasSearchQuery || selectedItemIds.length > 0}
                  selectedItemIds={selectedItemIds}
                  onSelectionChange={handleSelectionChange}
                />
              </Tabs.Content>
              <Tabs.Content
                value="combined"
                className="widened "
              >
                <CombinedListGrid
                  items={filteredCombinedItems}
                  loading={combinedLoading}
                  onEditCombinedItems={handleEditCombinedItems}
                />
              </Tabs.Content>
            </Tabs.Root>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}