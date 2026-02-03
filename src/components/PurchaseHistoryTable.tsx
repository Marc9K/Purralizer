import { useMemo } from "react";
import {
  Card,
  Box,
  Text,
  Table,
  ProgressCircle,
  Tooltip,
} from "@chakra-ui/react";
import { formatNumber, formatDateTime, formatShortDate } from "../utils/format";
import type { PurchaseHistoryItem } from "../db/operations";

interface PurchaseHistoryTableProps {
  purchaseHistory: PurchaseHistoryItem[] | undefined;
  loading: boolean;
}

export default function PurchaseHistoryTable({
  purchaseHistory,
  loading,
}: PurchaseHistoryTableProps) {
  // Check if we should show weight column (at least some are non-1/0/null)
  const showWeightColumn = useMemo(() => {
    if (!purchaseHistory || purchaseHistory.length === 0) return false;
    return purchaseHistory.some(
      (p) => p.weight !== null && p.weight !== 0 && p.weight !== 1
    );
  }, [purchaseHistory]);

  // Check if we should show quantity column (at least some are non-1/0/null)
  // Only show if quantities are different from weights
  const showQuantityColumn = useMemo(() => {
    if (!purchaseHistory || purchaseHistory.length === 0) return false;
    if (!showWeightColumn) {
      // If no weight column, show quantity if valid
      return purchaseHistory.some(
        (p) =>
          p.trueQuantity !== null &&
          p.trueQuantity !== 0 &&
          p.trueQuantity !== 1
      );
    }
    // If weight column exists, only show quantity if it's different from weight
    return purchaseHistory.some((p) => {
      const hasValidWeight =
        p.weight !== null && p.weight !== 0 && p.weight !== 1;
      const hasValidQuantity =
        p.trueQuantity !== null && p.trueQuantity !== 0 && p.trueQuantity !== 1;
      return (
        hasValidQuantity && (!hasValidWeight || p.weight !== p.trueQuantity)
      );
    });
  }, [purchaseHistory, showWeightColumn]);

  // Check if we should show cost column (not all quantities are 1)
  const showCostColumn = useMemo(() => {
    if (!purchaseHistory || purchaseHistory.length === 0) return false;
    return !purchaseHistory.every(
      (p) =>
        p.trueQuantity === null || p.trueQuantity === 0 || p.trueQuantity === 1
    );
  }, [purchaseHistory]);

  if (loading) {
    return (
      <Card.Root variant="outline" className="data-card">
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
      <Card.Root variant="outline" className="data-card">
        <Card.Body>
          <Card.Title mb={4}>Purchase History</Card.Title>
          <Text color="fg.muted">No purchase history available</Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root variant="outline" className="data-card" maxW='xl'>
      <Card.Body>
        <Card.Title mb={4}>Purchase History</Card.Title>
        <Table.Root className="data-table">
          <Table.Header className="data-table">
            <Table.Row className="data-table">
              <Table.ColumnHeader className="data-table">Date</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end" className="data-table">Price</Table.ColumnHeader>
              {showWeightColumn && (
                <Table.ColumnHeader textAlign="end" className="data-table">
                  Weight (kg)
                </Table.ColumnHeader>
              )}
              {showQuantityColumn && (
                <Table.ColumnHeader textAlign="end" className="data-table">
                  Quantity
                </Table.ColumnHeader>
              )}
              {showCostColumn && (
                <Table.ColumnHeader textAlign="end" className="data-table">Cost</Table.ColumnHeader>
              )}
            </Table.Row>
          </Table.Header>
          <Table.Body className="data-table">
            {purchaseHistory.map((purchase, index) => {
              const hasValidWeight =
                purchase.weight !== null &&
                purchase.weight !== 0 &&
                purchase.weight !== 1;

              const hasValidQuantity =
                purchase.trueQuantity !== null &&
                purchase.trueQuantity !== 0 &&
                purchase.trueQuantity !== 1;

              // Cost is calculated in SQL - show if weight or quantity is valid
              const showCost =
                (hasValidWeight || hasValidQuantity) &&
                purchase.cost !== null &&
                purchase.cost !== 0 &&
                purchase.cost !== purchase.price;

              return (
                <Table.Row key={index} className="data-table">
                  <Table.Cell className="data-table">
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <span>{formatShortDate(purchase.timestamp)}</span>
                      </Tooltip.Trigger>
                      <Tooltip.Positioner>
                        <Tooltip.Content>
                          {formatDateTime(purchase.timestamp)}
                        </Tooltip.Content>
                      </Tooltip.Positioner>
                    </Tooltip.Root>
                  </Table.Cell>
                  <Table.Cell textAlign="end" className="data-table">
                    £{formatNumber(purchase.price)}
                  </Table.Cell>
                  {showWeightColumn && (
                    <Table.Cell textAlign="end" className="data-table">
                      {hasValidWeight && purchase.weight !== null
                        ? `${formatNumber(purchase.weight)}`
                        : "1"}
                    </Table.Cell>
                  )}
                  {showQuantityColumn && (
                    <Table.Cell textAlign="end" className="data-table">
                      {hasValidQuantity && purchase.trueQuantity !== null
                        ? `${formatNumber(purchase.trueQuantity)}`
                        : "1"}
                    </Table.Cell>
                  )}
                  {showCostColumn && (
                    <Table.Cell textAlign="end" className="data-table">
                      {showCost && purchase.cost !== null
                        ? `£${formatNumber(purchase.cost)}`
                        : ""}
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Card.Body>
    </Card.Root>
  );
}
