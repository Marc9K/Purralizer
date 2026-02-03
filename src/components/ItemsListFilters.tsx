import {
  Box,
  HStack,
  Input,
  Portal,
  ProgressCircle,
  Stack,
  Select,
  Switch,
  Text,
  createListCollection,
  InputGroup,
  CloseButton,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { SortDirection } from "../hooks/useItemsListLogic";

const sortFieldOptions = createListCollection({
  items: [
    { label: "Name", value: "name" },
    { label: "Total Bought", value: "totalQuantity" },
    { label: "Total Spent", value: "totalSpent" },
    { label: "Latest Price", value: "latestPrice" },
  ],
});

type ItemsListFiltersProps = {
  itemsCount: number;
  totalItemsCount: number | undefined;
  itemsLoading: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sortField: string[];
  onSortFieldChange: (value: string[]) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
};

export default function ItemsListFilters({
  itemsCount,
  totalItemsCount,
  itemsLoading,
  searchQuery,
  onSearchQueryChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onSortDirectionChange,
}: ItemsListFiltersProps) {
  const showTotalCount =
    searchQuery && totalItemsCount !== undefined && totalItemsCount > 0;
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const debounceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }
    if (localSearchQuery.trim().length === 0) {
      onSearchQueryChange("");
      return;
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        onSearchQueryChange(localSearchQuery);
      }
    }, 800);

    return () => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [localSearchQuery, onSearchQueryChange, searchQuery]);

  return (
    <Stack
      gap={4}
      direction={{ base: "column", md: "row" }}
      align={{ base: "stretch", md: "flex-end" }}
    >
      <Box flex={1}>
        <HStack gap={2} mb={2}>
          <Text fontSize="xl" fontWeight="bold">
            Items ({itemsCount}
            {showTotalCount && ` of ${totalItemsCount}`})
          </Text>
          {itemsLoading && (
            <ProgressCircle.Root value={null} size="sm">
              <ProgressCircle.Circle>
                <ProgressCircle.Track />
                <ProgressCircle.Range />
              </ProgressCircle.Circle>
            </ProgressCircle.Root>
          )}
        </HStack>
        <InputGroup endElement={<CloseButton onClick={() => setLocalSearchQuery("")} />}>
        <Input
          placeholder="Search items by name..."
          value={localSearchQuery}
          onChange={(e) => setLocalSearchQuery(e.target.value)}
        />
        </InputGroup>
      </Box>
      <HStack gap={2}>
      <Select.Root
        collection={sortFieldOptions}
        value={sortField}
        onValueChange={(e) => onSortFieldChange(e.value)}
        size="sm"
        width={{ base: "100%", md: "180px" }}
      >
        <Select.HiddenSelect />
        <Select.Label>Sort by</Select.Label>
        <Select.Control>
          <Select.Trigger>
            <Select.ValueText placeholder="Field..." />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Portal>
          <Select.Positioner>
            <Select.Content>
              {sortFieldOptions.items.map((option) => (
                <Select.Item item={option} key={option.value} color="fg.muted">
                  {option.label}
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
      <Switch.Root
        checked={sortDirection === "desc"}
        onCheckedChange={(e) =>
          onSortDirectionChange(e.checked ? "desc" : "asc")
        }
        size="lg"
        alignSelf={{ base: "flex-end", md: "flex-end" }}
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb>
            <Switch.ThumbIndicator fallback="↑">↓</Switch.ThumbIndicator>
          </Switch.Thumb>
        </Switch.Control>
      </Switch.Root>
      </HStack>
    </Stack>
  );
}
