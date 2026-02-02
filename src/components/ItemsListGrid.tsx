import { Center, ProgressCircle, SimpleGrid, Text } from "@chakra-ui/react";
import type { ItemWithStats } from "../db/operations";
import ItemsListItem from "./ItemsListItem.tsx";

type ItemsListGridProps = {
  items: ItemWithStats[];
  loading: boolean;
  showSelectionControls: boolean;
  selectedItemIds: number[];
  onSelectionChange: (itemId: number, isSelected: boolean) => void;
};

export default function ItemsListGrid({
  items,
  loading,
  showSelectionControls,
  selectedItemIds,
  onSelectionChange,
}: ItemsListGridProps) {
  if (loading && items.length === 0) {
    return (
      <Center py={8} flexDirection="column">
        <ProgressCircle.Root value={null} size="md">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
        <Text mt={4} color="fg.muted">
          Loading items...
        </Text>
      </Center>
    );
  }

  return (
    <SimpleGrid
      columns={{ base: 1, md: 2, lg: 3 }}
      gap={4}
      className="widened "
    >
      {items.map((item) => (
        <ItemsListItem
          key={item.id}
          item={item}
          showSelectionControls={showSelectionControls}
          isSelected={selectedItemIds.includes(item.id)}
          onSelectionChange={onSelectionChange}
        />
      ))}
    </SimpleGrid>
  );
}
