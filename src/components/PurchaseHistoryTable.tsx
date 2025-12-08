import { useMemo } from "react";
import {
  Card,
  Box,
  Text,
  Table,
  ProgressCircle,
} from "@chakra-ui/react";
import { formatNumber, formatDateTime } from "../utils/format";
import type { PurchaseHistoryItem } from "../db/operations";

interface PurchaseHistoryTableProps {
  purchaseHistory: PurchaseHistoryItem[] | undefined;
  loading: boolean;
}

export default function PurchaseHistoryTable({
  purchaseHistory,
  loading,
}: PurchaseHistoryTableProps) {
  // Check if all weights and volumes are the same number
  const showOnlyWeight = useMemo(() => {
    if (!purchaseHistory || purchaseHistory.length === 0) return false;

    const validWeights = purchaseHistory
      .map((p) => p.weight)
      .filter((w) => w !== null && w !== 0 && w !== 1) as number[];
    const validVolumes = purchaseHistory
      .map((p) => p.volume)
      .filter((v) => v !== null && v !== 0 && v !== 1) as number[];

    return (
      validWeights.length > 0 &&
      validVolumes.length > 0 &&
      validWeights.every((w, index) => w === validVolumes[index])
    );
  }, [purchaseHistory]);

  if (loading) {
    return (
      <Card.Root variant="outline">
        <Card.Body>
          <Card.Title mb={4}>Purchase History</Card.Title>
          <Box textAlign="center" py={8}>
            <ProgressCircle.Root value={null} size="sm">
              <ProgressCircle.Circle>
                <ProgressCircle.Track />
                <ProgressCircle.Range />
              </ProgressCircle.Circle>
            </ProgressCircle.Root>
          </Box>
        </Card.Body>
      </Card.Root>
    );
  }

  if (!purchaseHistory || purchaseHistory.length === 0) {
    return (
      <Card.Root variant="outline">
        <Card.Body>
          <Card.Title mb={4}>Purchase History</Card.Title>
          <Text color="fg.muted">No purchase history available</Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root variant="outline">
      <Card.Body>
        <Card.Title mb={4}>Purchase History</Card.Title>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Date & Time</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Price</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Weight (kg)</Table.ColumnHeader>
              {!showOnlyWeight && (
                <Table.ColumnHeader textAlign="end">Volume (L)</Table.ColumnHeader>
              )}
              <Table.ColumnHeader textAlign="end">Cost</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {purchaseHistory.map((purchase, index) => {
              const showWeight =
                purchase.weight !== null &&
                purchase.weight !== 0 &&
                purchase.weight !== 1;
              const showVolume =
                !showOnlyWeight &&
                purchase.volume !== null &&
                purchase.volume !== 0 &&
                purchase.volume !== 1;

              // Cost is calculated in SQL
              const showCost =
                purchase.cost !== null &&
                purchase.cost !== 0 &&
                purchase.cost !== purchase.price;

              return (
                <Table.Row key={index}>
                  <Table.Cell>
                    {formatDateTime(purchase.timestamp)}
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    £{formatNumber(purchase.price)}
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    {showWeight && purchase.weight !== null
                      ? `${formatNumber(purchase.weight)}`
                      : ""}
                  </Table.Cell>
                  {!showOnlyWeight && (
                    <Table.Cell textAlign="end">
                      {showVolume && purchase.volume !== null
                        ? `${formatNumber(purchase.volume)}`
                        : ""}
                    </Table.Cell>
                  )}
                  <Table.Cell textAlign="end">
                    {showCost && purchase.cost !== null
                      ? `£${formatNumber(purchase.cost)}`
                      : ""}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Card.Body>
    </Card.Root>
  );
}

