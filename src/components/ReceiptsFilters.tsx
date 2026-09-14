import {
  Button,
  Field,
  HStack,
  Input,
  ProgressCircle,
  SegmentGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { ReceiptsViewMode } from "../hooks/useReceiptsLogic";

const viewModeItems = [
  { label: "Compact", value: "compact" },
  { label: "Full", value: "full" },
];

type ReceiptsFiltersProps = {
  receiptsCount: number;
  loading: boolean;
  fromDate: string;
  onFromDateChange: (value: string) => void;
  toDate: string;
  onToDateChange: (value: string) => void;
  hasDateFilter: boolean;
  onClearDateFilter: () => void;
  viewMode: ReceiptsViewMode;
  onViewModeChange: (value: ReceiptsViewMode) => void;
};

export default function ReceiptsFilters({
  receiptsCount,
  loading,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  hasDateFilter,
  onClearDateFilter,
  viewMode,
  onViewModeChange,
}: ReceiptsFiltersProps) {
  return (
    <Stack
      gap={4}
      direction={{ base: "column", md: "row" }}
      align={{ base: "stretch", md: "flex-end" }}
      justify="space-between"
      mt={4}
    >
      <HStack gap={2} align="flex-end" flexWrap="wrap">
        <Field.Root width={{ base: "100%", sm: "170px" }}>
          <Field.Label>From</Field.Label>
          <Input
            type="date"
            size="sm"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => onFromDateChange(event.target.value)}
          />
        </Field.Root>
        <Field.Root width={{ base: "100%", sm: "170px" }}>
          <Field.Label>To</Field.Label>
          <Input
            type="date"
            size="sm"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => onToDateChange(event.target.value)}
          />
        </Field.Root>
        {hasDateFilter && (
          <Button size="sm" variant="outline" onClick={onClearDateFilter}>
            All time
          </Button>
        )}
      </HStack>
      <HStack gap={3} align="center" justify="flex-end">
        <HStack gap={2}>
          <Text fontSize="sm" color="fg.muted">
            {receiptsCount} receipt{receiptsCount === 1 ? "" : "s"}
          </Text>
          {loading && (
            <ProgressCircle.Root value={null} size="sm">
              <ProgressCircle.Circle>
                <ProgressCircle.Track />
                <ProgressCircle.Range />
              </ProgressCircle.Circle>
            </ProgressCircle.Root>
          )}
        </HStack>
        <SegmentGroup.Root
          size="sm"
          value={viewMode}
          onValueChange={(details) => {
            if (details.value) {
              onViewModeChange(details.value as ReceiptsViewMode);
            }
          }}
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={viewModeItems} />
        </SegmentGroup.Root>
      </HStack>
    </Stack>
  );
}
