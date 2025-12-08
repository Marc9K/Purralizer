import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import {
  Button,
  VStack,
  Text,
  Box,
  FileUpload,
  ProgressCircle,
  HStack,
  SimpleGrid,
  Input,
  Select,
  Portal,
  Switch,
  createListCollection,
} from "@chakra-ui/react";
import {
  importPurchaseData,
  clearAllData,
  getItemsWithStats,
  getTotalSpent,
  getTotalItemsCount,
  type ItemWithStats,
} from "./db/operations";
import ItemDetail from "./ItemDetail";
import ItemCard from "./components/ItemCard";

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
  const [status, setStatus] = useState<string>(Status.IDLE);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<string[]>(["totalSpent"]);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Query for items with stats
  const currentSortField = (sortField[0] || "totalSpent") as SortField;
  const { data: items, loading: itemsLoading } = useQuery<
    ItemWithStats[]
  >(async () => {
    return await getItemsWithStats(
      searchQuery,
      currentSortField,
      sortDirection
    );
  }, [searchQuery, sortField, sortDirection]);

  const itemsArray = items ?? [];

  // Query for total count
  const { data: totalItemsCount } = useQuery<number>(
    async () => await getTotalItemsCount(),
    []
  );

  // Query for total spent across all purchases
  const { data: totalSpent } = useQuery<number>(
    async () => await getTotalSpent(),
    []
  );

  const handleFileAccept = async (details: { files: File[] }) => {
    const file = details.files[0];
    if (!file) return;

    setStatus(Status.READING_FILE);

    const result = await importPurchaseData(file);

    if (result.success) {
      setStatus(Status.SUCCESS);
    } else {
      setStatus(`Error: ${result.error || "Unknown error"}`);
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

    setStatus(Status.PROCESSING_DATA);
    const result = await clearAllData();

    if (result.success) {
      setStatus(Status.SUCCESS);
    } else {
      setStatus(`Error: ${result.error || "Unknown error"}`);
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
                  <ItemCard key={item.id} item={item} />
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
