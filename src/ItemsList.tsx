import {
  Box,
  Button,
  Dialog,
  HStack,
  Input,
  Tabs,
  Toaster,
  Toast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { createCombinedItem, getCombinedItems } from "./db/operations";
import CombinedListGrid from "./components/CombinedListGrid";
import ItemsListFilters from "./components/ItemsListFilters";
import ItemsListGrid from "./components/ItemsListGrid";
import ItemsListHeader from "./components/ItemsListHeader";
import { useItemsListLogic } from "./hooks/useItemsListLogic";

export default function ItemsList() {
  const {
    statusToaster,
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
  } = useItemsListLogic();

  const showItemsSection = itemsArray.length > 0 || itemsLoading;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [combinedItems, setCombinedItems] = useState<
    Awaited<ReturnType<typeof getCombinedItems>>
  >([]);
  const [combinedLoading, setCombinedLoading] = useState(true);
  const [combineDialogOpen, setCombineDialogOpen] = useState(false);
  const [combineName, setCombineName] = useState("");

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
    if (!hasSearchQuery) {
      setSelectedItemIds([]);
    }
  }, [hasSearchQuery]);

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
    <Box p={8}>
      <Toaster toaster={statusToaster}>
        {(toast) => (
          <Toast.Root>
            <Toast.Title>{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description>{toast.description}</Toast.Description>
            )}
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </Toaster>
      <VStack gap={4} align="stretch">
        <ItemsListHeader
          hasItems={hasItems}
          isBusy={isBusy}
          totalSpentDisplay={formattedTotalSpent}
          onFileAccept={handleFileAccept}
          onClearDatabase={handleClearDB}
          showSelectionControls={hasSearchQuery}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onCombineClick={() => setCombineDialogOpen(true)}
          combineDisabled={selectedItemIds.length === 0}
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
          <VStack gap={4} align="stretch" mt={8}>
            <ItemsListFilters
              itemsCount={itemsArray.length}
              totalItemsCount={totalItemsCount}
              itemsLoading={itemsLoading}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              sortField={sortField}
              onSortFieldChange={setSortField}
              sortDirection={sortDirection}
              onSortDirectionChange={setSortDirection}
            />
            <Tabs.Root defaultValue="items">
              <Tabs.List>
                <Tabs.Trigger value="items">Items</Tabs.Trigger>
                <Tabs.Trigger value="combined">Combined</Tabs.Trigger>
                <Tabs.Indicator />
              </Tabs.List>
              <Tabs.Content value="items">
                <ItemsListGrid
                  items={itemsArray}
                  loading={itemsLoading}
                  showSelectionControls={hasSearchQuery}
                  selectedItemIds={selectedItemIds}
                  onSelectionChange={handleSelectionChange}
                />
              </Tabs.Content>
              <Tabs.Content value="combined">
                <CombinedListGrid
                  items={combinedItems}
                  loading={combinedLoading}
                />
              </Tabs.Content>
            </Tabs.Root>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}