import { Box, Toaster, Toast, VStack } from "@chakra-ui/react";
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
        />
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
            <ItemsListGrid items={itemsArray} loading={itemsLoading} />
          </VStack>
        )}
      </VStack>
    </Box>
  );
}