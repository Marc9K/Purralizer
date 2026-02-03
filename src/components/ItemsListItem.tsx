import { Box, HStack } from "@chakra-ui/react";
import ItemCard from "./ItemCard";
import type { ItemWithStats } from "../db/operations";

type ItemsListItemProps = {
  item: ItemWithStats;
  showSelectionControls: boolean;
  isSelected: boolean;
  onSelectionChange: (itemId: number, isSelected: boolean) => void;
};

export default function ItemsListItem({
  item,
  showSelectionControls,
  isSelected,
  onSelectionChange,
}: ItemsListItemProps) {
  if (!showSelectionControls) {
    return <ItemCard item={item} />;
  }

  return (
    <HStack align="start" gap={3}>
      <Box flex={1} className="">
        <ItemCard
          item={item}
          showSelectionControls
          isSelected={isSelected}
          onSelectionChange={onSelectionChange}
        />
      </Box>
    </HStack>
  );
}
