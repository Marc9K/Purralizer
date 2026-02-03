import {
  Box,
  Button,
  Dialog,
  HStack,
  Input,
  Tabs,
  VStack,
} from "@chakra-ui/react";
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
  const [combinedItems, setCombinedItems] = useState<
    Awaited<ReturnType<typeof getCombinedItems>>
  >([]);
  const [combinedLoading, setCombinedLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("items");
  const [combineDialogOpen, setCombineDialogOpen] = useState(false);
  const [combineName, setCombineName] = useState("");
  const [editingCombinedId, setEditingCombinedId] = useState<number | null>(null);
  const [editingCombinedName, setEditingCombinedName] = useState("");

  const loadCombinedItems = () => {
    setCombinedLoading(true);
    getCombinedItems()
      .then(setCombinedItems)
      .finally(() => setCombinedLoading(false));
  };

  useEffect(() => {
    loadCombinedItems();
    window.addEventListener("db-update", loadCombinedItems);
    return () => window.removeEventListener("db-update", loadCombinedItems);
  }, []);

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

  const handleCombineConfirm = async () => {
    const name = combineName.trim();
    if (!name || selectedItemIds.length === 0) return;
    try {
      await createCombinedItem(name, selectedItemIds);
      setSelectedItemIds([]);
      setCombineName("");
      setCombineDialogOpen(false);
      window.dispatchEvent(new Event("db-update"));
    } catch (err) {
      statusToaster.create({
        title: "Combine failed",
        description: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    }
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
          onCombineClick={() => setCombineDialogOpen(true)}
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
        <Dialog.Root
          open={combineDialogOpen}
          onOpenChange={(e) => setCombineDialogOpen(e.open)}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Combine items</Dialog.Title>
                <Dialog.CloseTrigger />
              </Dialog.Header>
              <Dialog.Body>
                <Input
                  placeholder="Name for combined item"
                  value={combineName}
                  onChange={(e) => setCombineName(e.target.value)}
                />
              </Dialog.Body>
              <Dialog.Footer>
                <HStack gap={2}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCombineDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCombineConfirm}
                    disabled={!combineName.trim() || selectedItemIds.length === 0}
                  >
                    Create
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
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
              searchQuery={activeTab === "items" ? searchQuery : combinedSearchQuery}
              onSearchQueryChange={
                activeTab === "items" ? setSearchQuery : setCombinedSearchQuery
              }
              searchPlaceholder={
                activeTab === "items"
                  ? "Search items by name..."
                  : "Search combined items by name..."
              }
              isCombinedTab={activeTab === "combined"}
              sortField={sortField}
              onSortFieldChange={setSortField}
              sortDirection={sortDirection}
              onSortDirectionChange={setSortDirection}
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