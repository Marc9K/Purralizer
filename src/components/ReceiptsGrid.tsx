import { Center, ProgressCircle, SimpleGrid, Text } from "@chakra-ui/react";
import type { Receipt } from "../db/operations";
import type { ReceiptsViewMode } from "../hooks/useReceiptsLogic";
import ReceiptCard from "./ReceiptCard";

type ReceiptsGridProps = {
  receipts: Receipt[];
  loading: boolean;
  viewMode: ReceiptsViewMode;
};

export default function ReceiptsGrid({
  receipts,
  loading,
  viewMode,
}: ReceiptsGridProps) {
  if (loading && receipts.length === 0) {
    return (
      <Center py={8} flexDirection="column">
        <ProgressCircle.Root value={null} size="md">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
        <Text mt={4} color="fg.muted">
          Loading receipts...
        </Text>
      </Center>
    );
  }

  if (receipts.length === 0) {
    return (
      <Center py={8}>
        <Text color="fg.muted">No receipts in this timeframe.</Text>
      </Center>
    );
  }

  const expanded = viewMode === "full";

  return (
    <SimpleGrid
      columns={
        expanded ? { base: 1, lg: 2 } : { base: 1, md: 2, lg: 3 }
      }
      gap={4}
      className="widened "
      alignItems="start"
    >
      {receipts.map((receipt) => (
        // Keyed by view mode as well, so switching it hands every card a fresh
        // start rather than leaving the ones opened by hand behind.
        <ReceiptCard
          key={`${viewMode}-${receipt.id}`}
          receipt={receipt}
          defaultExpanded={expanded}
        />
      ))}
    </SimpleGrid>
  );
}
