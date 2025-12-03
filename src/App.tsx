import { useState, useEffect } from "react";
import {
  Button,
  VStack,
  Text,
  Box,
  FileUpload,
  ProgressCircle,
  HStack,
  Card,
  SimpleGrid,
  Stack,
  Input,
  Select,
  Portal,
  Switch,
  createListCollection,
} from "@chakra-ui/react";
import { liveQuery } from "dexie";
import { db, type Item } from "./db";

// Custom hook to use liveQuery with React
function useLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: unknown[] = []
): { data: T | undefined; loading: boolean } {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (result) => {
        setValue(result);
        setLoading(false);
      },
      error: (error) => {
        console.error("LiveQuery error:", error);
        setLoading(false);
      },
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data: value, loading };
}

interface ItemWithStats extends Item {
  latestPrice: number | null;
  totalQuantity: number;
  totalSpent: number;
}

const formatNumber = (num: number): string => {
  // Check if 3rd decimal is significant
  const twoDecimal = Math.round(num * 100) / 100;
  const threeDecimal = Math.round(num * 1000) / 1000;

  // If rounding to 2 decimals loses information, use 3
  if (Math.abs(twoDecimal - threeDecimal) > 0.0001) {
    return threeDecimal.toFixed(3);
  }
  return twoDecimal.toFixed(2);
};

const Status = {
  IDLE: "",
  READING_FILE: "Reading file...",
  PROCESSING_DATA: "Processing data...",
  SUCCESS: "Successfully imported purchases!",
} as const;

interface PurchaseData {
  requestId: string;
  purchases: Array<{
    timestamp: string;
    type: string;
    says: string;
    basketValueGross: number;
    overallBasketSavings: number;
    basketValueNet: number;
    numberOfItems: number;
    payment: Array<{
      type: string;
      category?: string;
      amount: number;
    }>;
    items: Array<{
      name: string;
      quantity: number;
      weight: number;
      price: number;
      volume: number;
    }>;
  }>;
  orders: any[];
}

type SortField = "totalQuantity" | "totalSpent" | "latestPrice" | "name";
type SortDirection = "asc" | "desc";

const sortFieldOptions = createListCollection({
  items: [
    { label: "Name", value: "name" },
    { label: "Total Bought", value: "totalQuantity" },
    { label: "Total Spent", value: "totalSpent" },
    { label: "Latest Price", value: "latestPrice" },
  ],
});

function App() {
  const [status, setStatus] = useState<string>(Status.IDLE);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<string[]>(["totalSpent"]);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Live query for items with stats
  const { data: items, loading: itemsLoading } = useLiveQuery<
    ItemWithStats[]
  >(async () => {
    let allItems;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      // Use Dexie filter for case-insensitive search
      allItems = await db.items
        .filter((item) => item.name.toLowerCase().includes(query))
        .toArray();
    } else {
      allItems = await db.items.toArray();
    }

    // Calculate stats for each item
    const itemsWithStats = await Promise.all(
      allItems.map(async (item) => {
        if (!item.id)
          return {
            ...item,
            latestPrice: null,
            totalQuantity: 0,
            totalSpent: 0,
          };

        // Get all prices for this item
        const prices = await db.prices
          .where("itemId")
          .equals(item.id)
          .toArray();

        if (prices.length === 0) {
          return {
            ...item,
            latestPrice: null,
            totalQuantity: 0,
            totalSpent: 0,
          };
        }

        // Get purchase IDs and calculate totals
        const purchaseIds = prices.map((p) => p.purchaseId);
        const totalQuantity = prices.length;
        const totalSpent = prices.reduce((sum, p) => sum + p.price, 0);

        // Get purchases sorted by timestamp descending to find latest
        const purchases = await db.purchases
          .where("id")
          .anyOf(purchaseIds)
          .sortBy("timestamp");

        // Reverse to get descending order (most recent first)
        purchases.reverse();

        // Find the price for the most recent purchase
        const latestPurchase = purchases[0];
        const latestPrice = latestPurchase?.id
          ? prices.find((p) => p.purchaseId === latestPurchase.id)?.price ??
            null
          : null;

        return {
          ...item,
          latestPrice,
          totalQuantity,
          totalSpent,
        };
      })
    );

    // Sort items
    const currentSortField = (sortField[0] || "totalSpent") as SortField;
    const currentSortDirection = sortDirection || "desc";

    itemsWithStats.sort((a, b) => {
      let aValue: number | string | null;
      let bValue: number | string | null;

      switch (currentSortField) {
        case "totalQuantity":
          aValue = a.totalQuantity;
          bValue = b.totalQuantity;
          break;
        case "totalSpent":
          aValue = a.totalSpent;
          bValue = b.totalSpent;
          break;
        case "latestPrice":
          aValue = a.latestPrice ?? 0;
          bValue = b.latestPrice ?? 0;
          break;
        case "name":
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
      }

      if (aValue < bValue) return currentSortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return itemsWithStats;
  }, [searchQuery, sortField, sortDirection]);

  const itemsArray = items ?? [];

  // Live query for total count
  const { data: totalItemsCount } = useLiveQuery<number>(async () => {
    return await db.items.count();
  }, []);

  const handleFileAccept = async (details: { files: File[] }) => {
    const file = details.files[0];
    if (!file) return;

    setStatus(Status.READING_FILE);

    try {
      const text = await file.text();
      const data: PurchaseData = JSON.parse(text);

      setStatus(Status.PROCESSING_DATA);

      // Prepare all purchases for bulk insert
      const purchasesToAdd = data.purchases.map((purchase) => ({
        timestamp: purchase.timestamp,
        type: purchase.type,
        says: purchase.says,
        basketValueGross: purchase.basketValueGross,
        overallBasketSavings: purchase.overallBasketSavings,
        basketValueNet: purchase.basketValueNet,
        numberOfItems: purchase.numberOfItems,
        payment: purchase.payment,
      }));

      // Bulk add purchases and get their IDs
      const purchaseIds = (await db.purchases.bulkAdd(purchasesToAdd, {
        allKeys: true,
      })) as unknown as number[];

      // Collect all unique items (deduplicate by name+weight+volume)
      const itemMap = new Map<
        string,
        { name: string; weight: number; volume: number }
      >();
      const itemToPriceMap = new Map<
        string,
        Array<{ purchaseIndex: number; price: number }>
      >();

      data.purchases.forEach((purchase, purchaseIndex) => {
        purchase.items.forEach((item) => {
          const itemKey = `${item.name}|${item.weight}|${item.volume}`;
          if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, {
              name: item.name,
              weight: item.weight,
              volume: item.volume,
            });
          }
          if (!itemToPriceMap.has(itemKey)) {
            itemToPriceMap.set(itemKey, []);
          }
          itemToPriceMap.get(itemKey)!.push({
            purchaseIndex,
            price: item.price,
          });
        });
      });

      // Check which items already exist in the database
      const itemsToAdd: Array<{
        name: string;
        weight: number;
        volume: number;
      }> = [];
      const existingItemMap = new Map<string, number>();

      for (const [itemKey, item] of itemMap.entries()) {
        const existingItem = await db.items
          .where("[name+weight+volume]")
          .equals([item.name, item.weight, item.volume])
          .first();

        if (existingItem && existingItem.id) {
          existingItemMap.set(itemKey, existingItem.id);
        } else {
          itemsToAdd.push(item);
        }
      }

      // Bulk add new items and get their IDs
      if (itemsToAdd.length > 0) {
        const newItemIds = (await db.items.bulkAdd(itemsToAdd, {
          allKeys: true,
        })) as unknown as number[];

        // Map new items to their IDs
        itemsToAdd.forEach((item, index) => {
          const itemKey = `${item.name}|${item.weight}|${item.volume}`;
          existingItemMap.set(itemKey, newItemIds[index]!);
        });
      }

      // Prepare all prices for bulk insert
      const pricesToAdd: Array<{
        purchaseId: number;
        itemId: number;
        price: number;
      }> = [];

      for (const [itemKey, prices] of itemToPriceMap.entries()) {
        const itemId = existingItemMap.get(itemKey);
        if (itemId) {
          prices.forEach(({ purchaseIndex, price }) => {
            pricesToAdd.push({
              purchaseId: purchaseIds[purchaseIndex],
              itemId,
              price,
            });
          });
        }
      }

      // Bulk add prices
      await db.prices.bulkAdd(pricesToAdd);

      setStatus(Status.SUCCESS);
      // Items will automatically update via liveQuery
    } catch (error) {
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  return (
    <Box p={8}>
      <VStack gap={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold">
          Import Purchase Data
        </Text>
        <FileUpload.Root
          accept={{ "application/json": [".json"] }}
          onFileAccept={handleFileAccept}
        >
          <FileUpload.HiddenInput />
          <FileUpload.Trigger asChild>
            <Button colorPalette="black">Select JSON File</Button>
          </FileUpload.Trigger>
        </FileUpload.Root>
        {status !== Status.IDLE && (
          <HStack gap={3}>
            {(status === Status.READING_FILE ||
              status === Status.PROCESSING_DATA) && (
              <ProgressCircle.Root value={null} size="sm">
                <ProgressCircle.Circle>
                  <ProgressCircle.Track />
                  <ProgressCircle.Range />
                </ProgressCircle.Circle>
              </ProgressCircle.Root>
            )}
            <Text
              color={
                status.startsWith("Error")
                  ? "red.500"
                  : status === Status.SUCCESS
                  ? "green.500"
                  : "fg.default"
              }
            >
              {status}
            </Text>
          </HStack>
        )}
        {(itemsArray.length > 0 || itemsLoading) && (
          <VStack gap={4} align="stretch" mt={8}>
            <HStack gap={4} align="flex-end">
              <Box flex={1}>
                <HStack gap={2} mb={2}>
                  <Text fontSize="xl" fontWeight="bold">
                    Items ({itemsArray.length}
                    {searchQuery &&
                      totalItemsCount !== undefined &&
                      totalItemsCount > 0 &&
                      ` of ${totalItemsCount}`}
                    )
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
                <Input
                  placeholder="Search items by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Box>
              <Select.Root
                collection={sortFieldOptions}
                value={sortField}
                onValueChange={(e) => setSortField(e.value)}
                size="sm"
                width="180px"
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
                        <Select.Item item={option} key={option.value}>
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
                  setSortDirection(e.checked ? "desc" : "asc")
                }
                size="lg"
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb>
                    <Switch.ThumbIndicator fallback="↑">
                      ↓
                    </Switch.ThumbIndicator>
                  </Switch.Thumb>
                </Switch.Control>
              </Switch.Root>
            </HStack>
            {itemsLoading && itemsArray.length === 0 ? (
              <Box textAlign="center" py={8}>
                <ProgressCircle.Root value={null} size="md">
                  <ProgressCircle.Circle>
                    <ProgressCircle.Track />
                    <ProgressCircle.Range />
                  </ProgressCircle.Circle>
                </ProgressCircle.Root>
                <Text mt={4} color="fg.muted">
                  Loading items...
                </Text>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {itemsArray.map((item) => (
                  <Card.Root key={item.id} variant="outline">
                    <Card.Body>
                      <Card.Title>{item.name}</Card.Title>
                      <Card.Description>
                        <Stack gap={2} mt={2}>
                          <HStack gap={2}>
                            {item.weight > 0 && (
                              <Text fontSize="sm" color="fg.muted">
                                Weight: {formatNumber(item.weight)}g
                              </Text>
                            )}
                            {item.volume > 0 && (
                              <Text fontSize="sm" color="fg.muted">
                                Volume: {formatNumber(item.volume)}L
                              </Text>
                            )}
                          </HStack>
                          {item.latestPrice !== null && (
                            <Text fontSize="sm" fontWeight="medium">
                              Latest Price: £{formatNumber(item.latestPrice)}
                            </Text>
                          )}
                          {item.totalQuantity > 0 && (
                            <Text fontSize="sm" color="fg.muted">
                              Total Bought: {item.totalQuantity}
                            </Text>
                          )}
                          {item.totalSpent > 0 && (
                            <Text fontSize="sm" color="fg.muted">
                              Total Spent: £{formatNumber(item.totalSpent)}
                            </Text>
                          )}
                        </Stack>
                      </Card.Description>
                    </Card.Body>
                  </Card.Root>
                ))}
              </SimpleGrid>
            )}
          </VStack>
        )}
      </VStack>
    </Box>
  );
}

export default App;
