import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
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
import { Chart, useChart } from "@chakra-ui/charts";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { query, type Item } from "./db";

interface ItemWithStats extends Item {
  id: number;
  name: string;
  latestPrice: number | null;
  totalQuantity: number;
  totalSpent: number;
  weight?: number;
  volume?: number;
}

interface PurchaseHistory {
  timestamp: string;
  price: number;
  weight: number | null;
  volume: number | null;
  quantity: number;
  cost: number | null;
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

export default function ItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const { data: item, loading: itemLoading } = useQuery<
    ItemWithStats | undefined
  >(async () => {
    if (!itemId) return undefined;

    const items = await query<{ id: number; name: string }>(
      `SELECT id, name FROM items WHERE id = ?`,
      [Number(itemId)]
    );
    if (items.length === 0) return undefined;

    const item = items[0]!;

    // Get stats using SQL - latest price, total quantity, and total spent
    const stats = await query<{
      latestPrice: number | null;
      totalQuantity: number;
      totalSpent: number;
      weight: number | null;
      volume: number | null;
    }>(
      `SELECT 
        (SELECT p.price 
         FROM price_purchases pp
         JOIN prices p ON pp.priceId = p.id
         JOIN purchases pur ON pp.purchaseId = pur.id
         WHERE p.itemId = ?
         ORDER BY pur.timestamp DESC
         LIMIT 1) as latestPrice,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM amounts a2
            JOIN price_purchases pp2 ON pp2.purchaseId = a2.purchaseId
            JOIN prices p2 ON pp2.priceId = p2.id
            WHERE p2.itemId = ? 
            AND a2.weight IS NOT NULL 
            AND a2.weight > 0 
            AND a2.weight != 1
          )
          THEN COALESCE(SUM(a.weight * a.quantity), 0)
          ELSE COALESCE(SUM(a.quantity), 0)
        END as totalQuantity,
        COALESCE(SUM(
          CASE 
            WHEN a.weight IS NOT NULL AND a.weight > 0 AND a.weight != 1 
            THEN p.price * a.weight * a.quantity
            WHEN a.volume IS NOT NULL AND a.volume > 0 AND a.volume != 1 
            THEN p.price * a.volume * a.quantity
            ELSE p.price * a.quantity
          END
        ), 0) as totalSpent,
        (SELECT weight FROM amounts WHERE itemId = ? LIMIT 1) as weight,
        (SELECT volume FROM amounts WHERE itemId = ? LIMIT 1) as volume
       FROM price_purchases pp
       JOIN prices p ON pp.priceId = p.id
       JOIN purchases pur ON pp.purchaseId = pur.id
       LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = p.itemId
       WHERE p.itemId = ?`,
      [item.id, item.id, item.id, item.id, item.id]
    );

    const stat = stats[0]!;

    return {
      ...item,
      latestPrice: stat.latestPrice,
      totalQuantity: stat.totalQuantity,
      totalSpent: stat.totalSpent,
      weight: stat.weight ?? undefined,
      volume: stat.volume ?? undefined,
    };
  }, [itemId]);

  const { data: purchaseHistory, loading: historyLoading } = useQuery<
    PurchaseHistory[]
  >(async () => {
    if (!itemId || !item?.id) return [];

    const history = await query<PurchaseHistory>(
      `SELECT 
        pur.timestamp, 
        p.price, 
        a.weight, 
        a.volume, 
        a.quantity,
        CASE 
          WHEN a.weight IS NOT NULL AND a.weight > 0 AND a.weight != 1 
          THEN p.price * a.weight
          WHEN a.volume IS NOT NULL AND a.volume > 0 AND a.volume != 1 
          THEN p.price * a.volume
          ELSE NULL
        END as cost
       FROM price_purchases pp
       JOIN prices p ON pp.priceId = p.id
       JOIN purchases pur ON pp.purchaseId = pur.id
       LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = p.itemId
       WHERE p.itemId = ?
       ORDER BY pur.timestamp DESC`,
      [Number(itemId)]
    );
    return history;
  }, [itemId, item?.id]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!purchaseHistory || purchaseHistory.length === 0) return [];

    return purchaseHistory
      .slice()
      .reverse()
      .map((purchase) => {
        // Calculate quantity bought (weight if valid, otherwise quantity)
        const quantityBought =
          purchase.weight !== null &&
          purchase.weight !== 0 &&
          purchase.weight !== 1
            ? purchase.weight * purchase.quantity
            : purchase.quantity;

        return {
          timestamp: formatDateTime(purchase.timestamp),
          date: new Date(purchase.timestamp).getTime(),
          price: purchase.price,
          quantityBought: quantityBought,
        };
      });
  }, [purchaseHistory]);

  // Check if all quantities are 1
  const showQuantity = useMemo(() => {
    if (chartData.length === 0) return false;
    return !chartData.every((d) => d.quantityBought === 1);
  }, [chartData]);

  const chart = useChart({
    data: chartData,
    series: [
      { name: "price" as const, color: "blue.solid", label: "Price (£)" },
      ...(showQuantity
        ? [
            {
              name: "quantityBought" as const,
              color: "green.solid",
              label: "Quantity Bought",
            },
          ]
        : []),
    ],
  });

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
                {item.weight !== undefined && item.weight > 0 && (
                  <Text fontSize="md" color="fg.muted">
                    Weight: {formatNumber(item.weight)}g
                  </Text>
                )}
                {item.volume !== undefined && item.volume > 0 && (
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

        {chartData.length > 0 && (
          <Card.Root variant="outline">
            <Card.Body>
              <Card.Title mb={4}>Price & Quantity Over Time</Card.Title>
              <Chart.Root maxH="sm" chart={chart}>
                <LineChart data={chart.data}>
                  <CartesianGrid
                    stroke={chart.color("border")}
                    vertical={false}
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="timestamp"
                    stroke={chart.color("border")}
                    tickFormatter={(value) => {
                      const dataPoint = chartData.find(
                        (d) => d.timestamp === value
                      );
                      if (!dataPoint) return value;
                      const date = new Date(dataPoint.date);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    stroke={chart.color("border")}
                    yAxisId="left"
                  />
                  {showQuantity && (
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      orientation="right"
                      stroke={chart.color("border")}
                      yAxisId="right"
                    />
                  )}
                  <Tooltip
                    animationDuration={100}
                    cursor={{ stroke: chart.color("border") }}
                    content={<Chart.Tooltip />}
                  />
                  <Legend content={<Chart.Legend />} />
                  <Line
                    yAxisId="left"
                    isAnimationActive={false}
                    dataKey="price"
                    stroke={chart.color("blue.solid")}
                    strokeWidth={2}
                    dot={false}
                  />
                  {showQuantity && (
                    <Line
                      yAxisId="right"
                      isAnimationActive={false}
                      dataKey="quantityBought"
                      stroke={chart.color("green.solid")}
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </Chart.Root>
            </Card.Body>
          </Card.Root>
        )}

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
              (() => {
                // Check if all weights and volumes are the same number
                const validWeights = purchaseHistory
                  .map((p) => p.weight)
                  .filter((w) => w !== null && w !== 0 && w !== 1) as number[];
                const validVolumes = purchaseHistory
                  .map((p) => p.volume)
                  .filter((v) => v !== null && v !== 0 && v !== 1) as number[];

                const showOnlyWeight = validWeights.every(
                  (w, index) => w === validVolumes[index]
                );

                return (
                  <Table.Root>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Date & Time</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          Price
                        </Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          Weight (kg)
                        </Table.ColumnHeader>
                        {!showOnlyWeight && (
                          <Table.ColumnHeader textAlign="end">
                            Volume (L)
                          </Table.ColumnHeader>
                        )}
                        <Table.ColumnHeader textAlign="end">
                          Cost
                        </Table.ColumnHeader>
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
                );
              })()
            ) : (
              <Text color="fg.muted">No purchase history available</Text>
            )}
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  );
}
