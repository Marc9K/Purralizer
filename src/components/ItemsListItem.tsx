import { Box, Checkbox, HStack } from "@chakra-ui/react";
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
      <Checkbox.Root
        aria-label={`Select ${item.name}`}
        checked={isSelected}
        onCheckedChange={(e) =>
          onSelectionChange(item.id, e.checked === true)
        }
        mt={2}
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Root>
      <Box flex={1}>
        <ItemCard item={item} />
      </Box>
    </HStack>
  );
}
