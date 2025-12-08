import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
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
import { query, insert, insertMany, clearDatabase, type Item } from "./db";
import ItemDetail from "./ItemDetail";

// Custom hook to use queries with React (polling-based since sql.js doesn't have liveQuery)
function useQuery<T>(
  querier: () => Promise<T> | T,
  deps: unknown[] = []
): { data: T | undefined; loading: boolean } {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        const result = await querier();
        setValue(result);
        setLoading(false);
      } catch (error) {
        console.error("Query error:", error);
        setLoading(false);
      }
    };
    fetchData();

    // Listen for database updates
    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener("db-update", handleUpdate);

    return () => {
      window.removeEventListener("db-update", handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data: value, loading };
}

interface ItemWithStats extends Item {
  id: number;
  name: string;
  latestPrice: number | null;
  totalQuantity: number;
  totalSpent: number;
  weight?: number;
  volume?: number;
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

function ItemsList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>(Status.IDLE);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<string[]>(["totalSpent"]);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Query for items with stats - single SQL query with all calculations
  const { data: items, loading: itemsLoading } = useQuery<
    ItemWithStats[]
  >(async () => {
    // Build SQL query with filtering, stats calculation, and sorting
    const currentSortField = (sortField[0] || "totalSpent") as SortField;
    const currentSortDirection = sortDirection || "desc";

    let orderByClause = "";
    switch (currentSortField) {
      case "totalQuantity":
        orderByClause = "ORDER BY totalQuantity";
        break;
      case "totalSpent":
        orderByClause = "ORDER BY totalSpent";
        break;
      case "latestPrice":
        orderByClause = "ORDER BY latestPrice";
        break;
      case "name":
      default:
        orderByClause = "ORDER BY LOWER(i.name)";
        break;
    }
    orderByClause += currentSortDirection === "asc" ? " ASC" : " DESC";

    const searchCondition =
      searchQuery && searchQuery.trim() ? `AND LOWER(i.name) LIKE ?` : "";
    const searchParam =
      searchQuery && searchQuery.trim()
        ? [`%${searchQuery.toLowerCase().trim()}%`]
        : [];

    const itemsWithStats = await query<ItemWithStats>(
      `SELECT 
        i.id,
        i.name,
        MAX(CASE 
          WHEN a.weight IS NOT NULL AND a.weight > 0 AND a.weight != 1 
          THEN a.weight 
        END) as weight,
        MAX(CASE 
          WHEN a.volume IS NOT NULL AND a.volume > 0 AND a.volume != 1 
          THEN a.volume 
        END) as volume,
        COALESCE(SUM(a.quantity), 0) as totalQuantity,
        COALESCE(SUM(p.price * COALESCE(a.quantity, 1)), 0) as totalSpent,
        (
          SELECT p2.price 
          FROM price_purchases pp2
          JOIN prices p2 ON pp2.priceId = p2.id
          JOIN purchases pur2 ON pp2.purchaseId = pur2.id
          WHERE p2.itemId = i.id
          ORDER BY pur2.timestamp DESC
          LIMIT 1
        ) as latestPrice
      FROM items i
      LEFT JOIN price_purchases pp ON pp.priceId IN (
        SELECT id FROM prices WHERE itemId = i.id
      )
      LEFT JOIN prices p ON pp.priceId = p.id
      LEFT JOIN purchases pur ON pp.purchaseId = pur.id
      LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = i.id
      WHERE 1=1 ${searchCondition}
      GROUP BY i.id, i.name
      ${orderByClause}`,
      searchParam
    );

    // Convert null weight/volume to undefined and ensure proper types
    return itemsWithStats.map((item) => ({
      ...item,
      weight: item.weight ?? undefined,
      volume: item.volume ?? undefined,
      latestPrice: item.latestPrice ?? null,
      totalQuantity: item.totalQuantity ?? 0,
      totalSpent: item.totalSpent ?? 0,
    }));
  }, [searchQuery, sortField, sortDirection]);

  const itemsArray = items ?? [];

  // Query for total count
  const { data: totalItemsCount } = useQuery<number>(async () => {
    const result = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM items`
    );
    return result[0]?.count ?? 0;
  }, []);

  // Query for total spent across all purchases
  const { data: totalSpent } = useQuery<number>(async () => {
    const result = await query<{ total: number | null }>(
      `SELECT SUM(p.price) as total 
       FROM price_purchases pp
       JOIN prices p ON pp.priceId = p.id`
    );
    return result[0]?.total ?? 0;
  }, []);

  const handleFileAccept = async (details: { files: File[] }) => {
    const file = details.files[0];
    if (!file) return;

    setStatus(Status.READING_FILE);

    try {
      const text = await file.text();
      const data: PurchaseData = JSON.parse(text);

      setStatus(Status.PROCESSING_DATA);

      // Insert purchases in bulk and get their IDs
      // Convert undefined values to null for SQL
      const purchaseParams = data.purchases.map((purchase) => [
        purchase.timestamp ?? null,
        purchase.type ?? null,
        purchase.says ?? null,
        purchase.basketValueGross ?? null,
        purchase.overallBasketSavings ?? null,
        purchase.basketValueNet ?? null,
        purchase.numberOfItems ?? null,
        purchase.payment ? JSON.stringify(purchase.payment) : null,
      ]);
      const purchaseIds = await insertMany(
        `INSERT INTO purchases (timestamp, type, says, basketValueGross, overallBasketSavings, basketValueNet, numberOfItems, payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        purchaseParams
      );
      // Process each purchase's items
      for (
        let purchaseIndex = 0;
        purchaseIndex < data.purchases.length;
        purchaseIndex++
      ) {
        const purchase = data.purchases[purchaseIndex];
        const purchaseId = purchaseIds[purchaseIndex]!;

        for (const item of purchase.items) {
          // Find or create item by name (case-insensitive)
          const existingItems = await query<{ id: number; name: string }>(
            `SELECT id, name FROM items WHERE LOWER(name) = LOWER(?)`,
            [item.name]
          );

          let itemId: number;
          if (existingItems.length > 0) {
            itemId = existingItems[0]!.id;
          } else {
            itemId = await insert(`INSERT INTO items (name) VALUES (?)`, [
              item.name,
            ]);
          }

          // Find or create price by item name and price value
          const existingPrices = await query<{
            id: number;
            itemId: number;
            price: number;
          }>(
            `SELECT p.id, p.itemId, p.price 
             FROM prices p 
             JOIN items i ON p.itemId = i.id 
             WHERE LOWER(i.name) = LOWER(?) AND p.price = ?`,
            [item.name, item.price]
          );

          let priceId: number;
          if (existingPrices.length > 0) {
            priceId = existingPrices[0]!.id;
          } else {
            priceId = await insert(
              `INSERT INTO prices (itemId, price) VALUES (?, ?)`,
              [itemId, item.price]
            );
          }

          // Link price to purchase (many-to-many)
          try {
            await insert(
              `INSERT INTO price_purchases (priceId, purchaseId) VALUES (?, ?)`,
              [priceId, purchaseId]
            );
          } catch (error) {
            // Ignore if already exists (unique constraint)
          }

          // Insert amount record (handle undefined weight/volume as NULL)
          await insert(
            `INSERT INTO amounts (purchaseId, itemId, weight, volume, quantity) VALUES (?, ?, ?, ?, ?)`,
            [
              purchaseId,
              itemId,
              item.weight ?? null,
              item.volume ?? null,
              item.quantity,
            ]
          );
        }
      }

      setStatus(Status.SUCCESS);
      // Trigger a refresh by updating a dependency
      window.dispatchEvent(new Event("db-update"));
    } catch (error) {
      setStatus(`Error: ${String(error)}`);
    }
  };

  const handleClearDB = async () => {
    if (
      !confirm(
        "Are you sure you want to clear all database data? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setStatus(Status.PROCESSING_DATA);
      await clearDatabase();
      setStatus(Status.SUCCESS);
      // Trigger a refresh
      window.dispatchEvent(new Event("db-update"));
    } catch (error) {
      setStatus(`Error: ${String(error)}`);
    }
  };
  console.log(itemsArray);
  return (
    <Box p={8}>
      <VStack gap={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold">
          Import Purchase Data
        </Text>
        <HStack gap={3}>
          <FileUpload.Root
            accept={{ "application/json": [".json"] }}
            onFileAccept={handleFileAccept}
          >
            <FileUpload.HiddenInput />
            <FileUpload.Trigger asChild>
              <Button colorPalette="black">Select JSON File</Button>
            </FileUpload.Trigger>
          </FileUpload.Root>
          <Button
            colorPalette="red"
            onClick={handleClearDB}
            disabled={
              status === Status.READING_FILE ||
              status === Status.PROCESSING_DATA
            }
          >
            Clear Database
          </Button>
        </HStack>
        {status !== Status.IDLE && (
          <HStack gap={3} align="center">
            {(status === Status.READING_FILE ||
              status === Status.PROCESSING_DATA) && (
              <ProgressCircle.Root value={null} size="md">
                <ProgressCircle.Circle>
                  <ProgressCircle.Track />
                  <ProgressCircle.Range />
                </ProgressCircle.Circle>
              </ProgressCircle.Root>
            )}
            <Text
              fontSize="md"
              fontWeight="medium"
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
        {totalSpent !== undefined && totalSpent > 0 && (
          <Box
            p={4}
            bg="blue.50"
            borderRadius="md"
            borderWidth="1px"
            borderColor="blue.200"
          >
            <Text fontSize="lg" fontWeight="bold" color="blue.900">
              Total Spent: £{formatNumber(totalSpent)}
            </Text>
          </Box>
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
                  <Card.Root
                    key={item.id}
                    variant="outline"
                    cursor="pointer"
                    onClick={() => navigate(`/item/${item.id}`)}
                    _hover={{ borderColor: "blue.500" }}
                  >
                    <Card.Body>
                      <Card.Title>{item.name}</Card.Title>
                      <Card.Description>
                        <Stack gap={2} mt={2}>
                          <HStack gap={2}>
                            {item.weight !== undefined && item.weight > 0 && (
                              <Text fontSize="sm" color="fg.muted">
                                Weight: {formatNumber(item.weight)}g
                              </Text>
                            )}
                            {item.volume !== undefined && item.volume > 0 && (
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

function App() {
  return (
    <Routes>
      <Route path="/" element={<ItemsList />} />
      <Route path="/item/:itemId" element={<ItemDetail />} />
    </Routes>
  );
}

export default App;
