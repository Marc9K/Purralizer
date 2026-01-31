import { Box, ProgressCircle, SimpleGrid, Text } from "@chakra-ui/react";
import type { ItemWithStats } from "../db/operations";
import ItemsListItem from "./ItemsListItem";

type ItemsListGridProps = {
  items: ItemWithStats[];
  loading: boolean;
};

export default function ItemsListGrid({ items, loading }: ItemsListGridProps) {
  if (loading && items.length === 0) {
    return (
      <Box textAlign="center" py={8}>
        <ProgressCircle.Root value={null} size="md">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
        <Text mt={4} color="fg.muted">
          Loading items...
        </Text>
      </Box>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {items.map((item) => (
        <ItemsListItem key={item.id} item={item} />
      ))}
    </SimpleGrid>
  );
}
