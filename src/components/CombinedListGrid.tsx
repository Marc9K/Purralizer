import { Center, ProgressCircle, SimpleGrid, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Card } from "@chakra-ui/react";
import type { CombinedItemRecord } from "../db/operations";
import { formatNumber } from "../utils/format";

type CombinedListGridProps = {
  items: CombinedItemRecord[];
  loading: boolean;
};

export default function CombinedListGrid({
  items,
  loading,
}: CombinedListGridProps) {
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
          Loading combined items...
        </Text>
      </Center>
    );
  }

  if (items.length === 0) {
    return (
      <Center py={8}>
        <Text color="fg.muted">
          No combined items yet. Search for items, select them, and use
          Combine to create one.
        </Text>
      </Center>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {items.map((item) => (
        <Link key={item.id} to={`/combined/${item.id}`}>
          <Card.Root
            width="100%"
            height="100%"
            variant="outline"
            cursor="pointer"
            _hover={{ borderColor: "blue.500" }}
            className="data-card"
          >
            <Card.Body>
              <Card.Title>{item.name}</Card.Title>
              <Text mt={2} fontSize="sm" color="fg.muted">
                Total Spent: £{formatNumber(item.totalSpent)}
              </Text>
            </Card.Body>
          </Card.Root>
        </Link>
      ))}
    </SimpleGrid>
  );
}
