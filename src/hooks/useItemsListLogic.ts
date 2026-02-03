import { useEffect, useState } from "react";
import type { createToaster } from "@chakra-ui/react";
import {
  importPurchaseData,
  importPurchaseDataFromXLSX,
  clearAllData,
  getItemsWithStats,
  getTotalSpent,
  getTotalItemsCount,
  type ItemWithStats,
} from "../db/operations";

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

export type SortField = "totalQuantity" | "totalSpent" | "latestPrice" | "name";
export type SortDirection = "asc" | "desc";

type FileAcceptDetails = { files: File[] };

type StatusToaster = ReturnType<typeof createToaster>;

export function useItemsListLogic(statusToaster: StatusToaster) {
  const [status, setStatus] = useState<string>(Status.IDLE);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<string[]>(["totalSpent"]);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Query for items with stats
  const currentSortField = (sortField[0] || "totalSpent") as SortField;
  const { data: items, loading: itemsLoading } = useQuery<ItemWithStats[]>(
    async () => {
      return await getItemsWithStats(
        searchQuery,
        currentSortField,
        sortDirection
      );
    },
    [searchQuery, sortField, sortDirection]
  );

  const itemsArray = items ?? [];
  const hasItems = itemsArray.length > 0;

  useEffect(() => {
    if (status === Status.IDLE) {
      return;
    }

    const isLoading =
      status === Status.READING_FILE || status === Status.PROCESSING_DATA;
    const isError = status.startsWith("Error");

    statusToaster.create({
      id: "import-status",
      title: isError ? "Import failed" : status,
      description: isError ? status : undefined,
      type: isError ? "error" : isLoading ? "loading" : "success",
      duration: isLoading ? 999999 : 4000,
    });
  }, [status]);

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

  const handleFileAccept = async (details: FileAcceptDetails) => {
    const file = details.files[0];
    if (!file) return;

    setStatus(Status.READING_FILE);

    let result: { success: boolean; error?: string } = {
      success: false,
      error: "Unsupported file type",
    };
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      result = await importPurchaseData(file);
    } else if (
      file.type === "application/vnd.ms-excel" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.name.endsWith(".xls") ||
      file.name.endsWith(".xlsx")
    ) {
      result = await importPurchaseDataFromXLSX(file);
    }

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

  const formattedTotalSpent =
    totalSpent !== undefined && totalSpent > 0
      ? formatNumber(totalSpent)
      : null;

  const isBusy =
    status === Status.READING_FILE || status === Status.PROCESSING_DATA;

  return {
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
  };
}
