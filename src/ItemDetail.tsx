import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  Box,
  VStack,
  Text,
  Card,
  Button,
  ProgressCircle,
  NumberInput,
  HStack,
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
import {
  getItemWithStats,
  getItemPurchaseHistory,
  getItemChartData,
  getDaysBetweenPurchasesData,
  getCombinedItemWithStats,
  getCombinedItemPurchaseHistory,
  getCombinedItemChartData,
  getCombinedItemDaysBetweenPurchasesData,
  type ItemWithStats,
  type PurchaseHistoryItem,
  type ChartDataPoint,
} from "./db/operations";
import ItemCard from "./components/ItemCard";
import PurchaseHistoryTable from "./components/PurchaseHistoryTable";
import { formatNumber } from "./utils/format";

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
  const { itemId, combinedId } = useParams<{
    itemId?: string;
    combinedId?: string;
  }>();
  const navigate = useNavigate();
  const isCombined = !!combinedId;
  const id = combinedId ?? itemId;

  const { data: item, loading: itemLoading } = useQuery<
    ItemWithStats | undefined
  >(async () => {
    if (!id) return undefined;
    const numId = Number(id);
    return isCombined
      ? await getCombinedItemWithStats(numId)
      : await getItemWithStats(numId);
  }, [id, isCombined]);

  const { data: purchaseHistory, loading: historyLoading } = useQuery<
    PurchaseHistoryItem[]
  >(async () => {
    if (!id) return [];
    const numId = Number(id);
    return isCombined
      ? await getCombinedItemPurchaseHistory(numId)
      : await getItemPurchaseHistory(numId);
  }, [id, isCombined]);

  const { data: chartData } = useQuery<ChartDataPoint[]>(async () => {
    if (!id) return [];
    const numId = Number(id);
    return isCombined
      ? await getCombinedItemChartData(numId)
      : await getItemChartData(numId);
  }, [id, isCombined]);

  const [excludeTopN, setExcludeTopN] = useState("0");

  const { data: daysBetweenResult } = useQuery<
    import("./db/operations").DaysBetweenPurchasesResult | undefined
  >(async () => {
    if (!id) return undefined;
    const numId = Number(id);
    const excludeCount = parseInt(excludeTopN, 10) || 0;
    return isCombined
      ? await getCombinedItemDaysBetweenPurchasesData(numId, excludeCount)
      : await getDaysBetweenPurchasesData(numId, excludeCount);
  }, [id, isCombined, excludeTopN]);

  const daysBetweenData = daysBetweenResult?.data;
  const averageDaysBetweenPurchases = daysBetweenResult?.averageDays ?? null;

  // Check if all quantities are 1
  const showQuantity = useMemo(() => {
    if (!chartData || chartData.length === 0) return false;
    return !chartData.every((d) => d.quantityBought === 1);
  }, [chartData]);

  const chart = useChart({
    data: chartData || [],
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

  const daysBetweenChart = useChart({
    data: daysBetweenData || [],
    series: [
      {
        name: "daysSinceLastPurchase" as const,
        color: "purple.solid",
        label: "Days Since Last Purchase",
      },
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
        {item && <ItemCard item={item} disableNavigation size="large" />}

        {averageDaysBetweenPurchases !== null && (
          <Card.Root variant="outline" className="data-card">
            <Card.Body>
              <HStack mb={4} justify="space-between" align="center">
                <Text>
                  Average days between purchases:{" "}
                  <Text as="span" fontWeight="semibold">
                    {formatNumber(averageDaysBetweenPurchases)} days
                  </Text>
                </Text>
                <HStack gap={2} align="center">
                  <Text fontSize="sm" color="fg.muted">
                    Exclude top
                  </Text>
                  <NumberInput.Root
                    value={excludeTopN}
                    onValueChange={(e) => setExcludeTopN(e.value)}
                    min={0}
                    max={100}
                    width="80px"
                  >
                    <NumberInput.Control />
                    <NumberInput.Input />
                  </NumberInput.Root>
                  <Text fontSize="sm" color="fg.muted">
                    outliers
                  </Text>
                </HStack>
              </HStack>
              {daysBetweenData && daysBetweenData.length > 0 && (
                <Chart.Root maxH="sm" chart={daysBetweenChart}>
                  <LineChart data={daysBetweenChart.data}>
                    <CartesianGrid
                      stroke={daysBetweenChart.color("border")}
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="timestamp"
                      stroke={daysBetweenChart.color("border")}
                      tickFormatter={(value) => {
                        const dataPoint = daysBetweenData?.find(
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
                      stroke={daysBetweenChart.color("border")}
                    />
                    <Tooltip
                      animationDuration={100}
                      cursor={{ stroke: daysBetweenChart.color("border") }}
                      content={<Chart.Tooltip />}
                    />
                    <Legend content={<Chart.Legend />} />
                    <Line
                      isAnimationActive={false}
                      dataKey="daysSinceLastPurchase"
                      stroke={daysBetweenChart.color("purple.solid")}
                      strokeWidth={0}
                      dot={{
                        r: 4,
                        fill: daysBetweenChart.color("purple.solid"),
                      }}
                    />
                  </LineChart>
                </Chart.Root>
              )}
            </Card.Body>
          </Card.Root>
        )}

        {chartData && chartData.length > 0 && (
          <Card.Root variant="outline" className="data-card">
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
                      const dataPoint = chartData?.find(
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
                      strokeWidth={0}
                      dot={{ r: 1.5, fill: chart.color("green.solid") }}
                    />
                  )}
                </LineChart>
              </Chart.Root>
            </Card.Body>
          </Card.Root>
        )}

        <PurchaseHistoryTable
          purchaseHistory={purchaseHistory}
          loading={historyLoading}
        />
      </VStack>
    </Box>
  );
}
