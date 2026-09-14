import { Card, SimpleGrid, Stat, Text } from "@chakra-ui/react";
import { Chart, useChart } from "@chakra-ui/charts";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { DailySpending, ReceiptsSummary } from "../hooks/useReceiptsLogic";
import { formatCurrency, formatDate } from "../utils/format";

type ReceiptsSummaryCardProps = {
  summary: ReceiptsSummary;
  dailySpending: DailySpending[];
  hasDateFilter: boolean;
};

export default function ReceiptsSummaryCard({
  summary,
  dailySpending,
  hasDateFilter,
}: ReceiptsSummaryCardProps) {
  const chart = useChart({
    data: dailySpending,
    series: [{ name: "total" as const, color: "blue.solid", label: "Spent" }],
  });

  const timeframe =
    summary.rangeStart && summary.rangeEnd
      ? `${formatDate(summary.rangeStart)} – ${formatDate(summary.rangeEnd)} (${
          summary.days
        } day${summary.days === 1 ? "" : "s"})`
      : hasDateFilter
        ? "No receipts in this timeframe"
        : "No receipts yet";

  const averages = [
    { label: "Per year", value: summary.perYear },
    { label: "Per month", value: summary.perMonth },
    { label: "Per week", value: summary.perWeek },
    { label: "Per day", value: summary.perDay },
  ];

  return (
    <Card.Root variant="outline" className="data-card">
      <Card.Body>
        <Card.Title mb={1}>Spending</Card.Title>
        <Text fontSize="sm" color="fg.muted" mb={4}>
          {timeframe}
        </Text>

        <SimpleGrid columns={{ base: 2, md: 5 }} gap={4} mb={6}>
          <Stat.Root>
            <Stat.Label>Total spent</Stat.Label>
            <Stat.ValueText>{formatCurrency(summary.total)}</Stat.ValueText>
            <Stat.HelpText>
              {summary.receiptsCount} receipt
              {summary.receiptsCount === 1 ? "" : "s"}
            </Stat.HelpText>
          </Stat.Root>
          {averages.map((average) => (
            <Stat.Root key={average.label}>
              <Stat.Label>{average.label}</Stat.Label>
              <Stat.ValueText>{formatCurrency(average.value)}</Stat.ValueText>
              <Stat.HelpText>on average</Stat.HelpText>
            </Stat.Root>
          ))}
        </SimpleGrid>

        {dailySpending.length > 0 && (
          <Chart.Root maxH="sm" chart={chart}>
            <BarChart data={chart.data}>
              <CartesianGrid stroke={chart.color("border")} vertical={false} />
              <XAxis
                axisLine={false}
                tickLine={false}
                dataKey={chart.key("label")}
                stroke={chart.color("border")}
                tickFormatter={(value: string) => value.slice(0, 5)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                stroke={chart.color("border")}
                tickFormatter={(value: number) => `£${value}`}
              />
              <Tooltip
                animationDuration={100}
                cursor={{
                  fill: chart.color("blue.solid"),
                  fillOpacity: 0.15,
                }}
                content={
                  <Chart.Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <Bar
                isAnimationActive={false}
                dataKey={chart.key("total")}
                fill={chart.color("blue.solid")}
              />
            </BarChart>
          </Chart.Root>
        )}
      </Card.Body>
    </Card.Root>
  );
}
