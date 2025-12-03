import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  Button,
  Stack,
  ProgressCircle,
  Table,
} from "@chakra-ui/react";
import { db, type Item, type Purchase } from "./db";
import { liveQuery } from "dexie";

interface ItemWithStats extends Item {
  latestPrice: number | null;
  totalQuantity: number;
  totalSpent: number;
}

interface PurchaseHistory {
  timestamp: string;
  price: number;
}

const formatNumber = (num: number): string => {
  const twoDecimal = Math.round(num * 100) / 100;
  const threeDecimal = Math.round(num * 1000) / 1000;

  if (Math.abs(twoDecimal - threeDecimal) > 0.0001) {
    return threeDecimal.toFixed(3);
  }
  return twoDecimal.toFixed(2);
};

const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

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

export default function ItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const { data: item, loading: itemLoading } = useLiveQuery<
    ItemWithStats | undefined
  >(async () => {
    if (!itemId) return undefined;

    const item = await db.items.get(Number(itemId));
    if (!item || !item.id) return undefined;

    const prices = await db.prices.where("itemId").equals(item.id).toArray();

    if (prices.length === 0) {
      return {
        ...item,
        latestPrice: null,
        totalQuantity: 0,
        totalSpent: 0,
      };
    }

    const purchaseIds = prices.map((p) => p.purchaseId);
    const totalQuantity = prices.length;
    const totalSpent = prices.reduce((sum, p) => sum + p.price, 0);

    const purchases = await db.purchases
      .where("id")
      .anyOf(purchaseIds)
      .sortBy("timestamp");

    purchases.reverse();

    const latestPurchase = purchases[0];
    const latestPrice = latestPurchase?.id
      ? prices.find((p) => p.purchaseId === latestPurchase.id)?.price ?? null
      : null;

    return {
      ...item,
      latestPrice,
      totalQuantity,
      totalSpent,
    };
  }, [itemId]);

  const { data: purchaseHistory, loading: historyLoading } = useLiveQuery<
    PurchaseHistory[]
  >(async () => {
    if (!itemId || !item?.id) return [];

    const prices = await db.prices
      .where("itemId")
      .equals(Number(itemId))
      .toArray();

    if (prices.length === 0) return [];

    const purchaseIds = prices.map((p) => p.purchaseId);
    const purchases = await db.purchases
      .where("id")
      .anyOf(purchaseIds)
      .toArray();

    const purchaseMap = new Map<number, Purchase>();
    purchases.forEach((p) => {
      if (p.id) purchaseMap.set(p.id, p);
    });

    const history: PurchaseHistory[] = prices
      .map((price) => {
        const purchase = purchaseMap.get(price.purchaseId);
        if (!purchase) return null;
        return {
          timestamp: purchase.timestamp,
          price: price.price,
        };
      })
      .filter((h): h is PurchaseHistory => h !== null)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return history;
  }, [itemId, item?.id]);

  if (itemLoading) {
    return (
      <Box p={8} textAlign="center">
        <ProgressCircle.Root value={null} size="md">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
        <Text mt={4} color="fg.muted">
          Loading item...
        </Text>
      </Box>
    );
  }

  if (!item) {
    return (
      <Box p={8}>
        <Text>Item not found</Text>
        <Button mt={4} onClick={() => navigate("/")}>
          Back to Items
        </Button>
      </Box>
    );
  }

  return (
    <Box p={8}>
      <VStack gap={6} align="stretch">
        <HStack>
          <Button onClick={() => navigate("/")} variant="outline">
            ← Back
          </Button>
        </HStack>

        <Card.Root variant="outline">
          <Card.Body>
            <Card.Title fontSize="2xl" mb={4}>
              {item.name}
            </Card.Title>
            <Stack gap={3}>
              <HStack gap={4}>
                {item.weight > 0 && (
                  <Text fontSize="md" color="fg.muted">
                    Weight: {formatNumber(item.weight)}g
                  </Text>
                )}
                {item.volume > 0 && (
                  <Text fontSize="md" color="fg.muted">
                    Volume: {formatNumber(item.volume)}L
                  </Text>
                )}
              </HStack>
              {item.latestPrice !== null && (
                <Text fontSize="lg" fontWeight="medium">
                  Latest Price: £{formatNumber(item.latestPrice)}
                </Text>
              )}
              <Text fontSize="md" color="fg.muted">
                Total Bought: {item.totalQuantity}
              </Text>
              {item.totalSpent > 0 && (
                <Text fontSize="md" color="fg.muted">
                  Total Spent: £{formatNumber(item.totalSpent)}
                </Text>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>

        <Card.Root variant="outline">
          <Card.Body>
            <Card.Title mb={4}>Purchase History</Card.Title>
            {historyLoading ? (
              <Box textAlign="center" py={8}>
                <ProgressCircle.Root value={null} size="sm">
                  <ProgressCircle.Circle>
                    <ProgressCircle.Track />
                    <ProgressCircle.Range />
                  </ProgressCircle.Circle>
                </ProgressCircle.Root>
              </Box>
            ) : purchaseHistory && purchaseHistory.length > 0 ? (
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Date & Time</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      Price
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {purchaseHistory.map((purchase, index) => (
                    <Table.Row key={index}>
                      <Table.Cell>
                        {formatDateTime(purchase.timestamp)}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        £{formatNumber(purchase.price)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            ) : (
              <Text color="fg.muted">No purchase history available</Text>
            )}
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  );
}
