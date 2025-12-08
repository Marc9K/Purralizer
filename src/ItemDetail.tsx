import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  Box,
  VStack,
  Text,
  Card,
  Button,
  ProgressCircle,
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
  type ItemWithStats,
  type PurchaseHistoryItem,
  type ChartDataPoint,
} from "./db/operations";
import ItemCard from "./components/ItemCard";
import PurchaseHistoryTable from "./components/PurchaseHistoryTable";

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
    return await getItemWithStats(Number(itemId));
  }, [itemId]);

  const { data: purchaseHistory, loading: historyLoading } = useQuery<
    PurchaseHistoryItem[]
  >(async () => {
    if (!itemId) return [];
    return await getItemPurchaseHistory(Number(itemId));
  }, [itemId]);

  const { data: chartData } = useQuery<ChartDataPoint[]>(async () => {
    if (!itemId) return [];
    return await getItemChartData(Number(itemId));
  }, [itemId]);

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

        {chartData && chartData.length > 0 && (
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
                      strokeWidth={2}
                      dot={false}
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
