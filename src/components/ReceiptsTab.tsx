import { VStack } from "@chakra-ui/react";
import ReceiptsFilters from "./ReceiptsFilters";
import ReceiptsGrid from "./ReceiptsGrid";
import ReceiptsSummaryCard from "./ReceiptsSummary";
import { useReceiptsLogic } from "../hooks/useReceiptsLogic";

export default function ReceiptsTab() {
  const {
    receipts,
    loading,
    viewMode,
    setViewMode,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    hasDateFilter,
    clearDateFilter,
    dailySpending,
    summary,
  } = useReceiptsLogic();

  return (
    <VStack gap={4} align="stretch" className="widened-vertical ">
      <ReceiptsFilters
        receiptsCount={receipts.length}
        loading={loading}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        hasDateFilter={hasDateFilter}
        onClearDateFilter={clearDateFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <ReceiptsSummaryCard
        summary={summary}
        dailySpending={dailySpending}
        hasDateFilter={hasDateFilter}
      />
      <ReceiptsGrid receipts={receipts} loading={loading} viewMode={viewMode} />
    </VStack>
  );
}
