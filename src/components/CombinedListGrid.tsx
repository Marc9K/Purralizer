import { Button, Center, HStack, Icon, ProgressCircle, SimpleGrid, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Card } from "@chakra-ui/react";
import type { CombinedItemRecord } from "../db/operations";
import { deleteCombinedItem } from "../db/operations";
import { formatNumber } from "../utils/format";
import { useState } from "react";
import { IoPencil, IoTrashBin } from "react-icons/io5";

type CombinedListGridProps = {
  items: CombinedItemRecord[];
  loading: boolean;
  onEditCombinedItems?: (details: {
    combinedItemId: number;
    name: string;
    itemIds: number[];
  }) => void;
};

export default function CombinedListGrid({
  items,
  loading,
  onEditCombinedItems,
}: CombinedListGridProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (combinedItemId: number) => {
    if (deletingId !== null) return;
    const confirmed = window.confirm("Delete this combined item?");
    if (!confirmed) return;
    setDeletingId(combinedItemId);
    try {
      await deleteCombinedItem(combinedItemId);
      window.dispatchEvent(new Event("db-update"));
    } catch (error) {
      console.error(error);
      window.alert("Failed to delete combined item.");
    } finally {
      setDeletingId(null);
    }
  };
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
    <SimpleGrid
      columns={{ base: 1, md: 2, lg: 3 }}
      gap={4}
      className="widened "
    >
      {items.map((item) => (
        <Link
          key={item.id}
          to={`/combined/${item.id}`}
          style={{ display: "block", width: "100%" }}
          className="widened "
        >
          <Card.Root
            width="100%"
            height="100%"
            variant="outline"
            cursor="pointer"
            _hover={{ borderColor: "blue.500" }}
            className="data-card widened "
          >
            <Card.Body className="">
              <HStack
                justify="space-between"
                align="start"
                gap={3}
                className=""
              >
                <Card.Title className="">{item.name}</Card.Title>

                <HStack>

                <Button
                  size="xs"
                  variant="outline"
                  colorPalette="red"
                  disabled={deletingId === item.id}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDelete(item.id);
                  }}
                >
                  <Icon>
                  <IoTrashBin />
                  </Icon>
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  colorPalette="blue"
                  disabled={!onEditCombinedItems || item.itemIds.length === 0}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEditCombinedItems?.({
                      combinedItemId: item.id,
                      name: item.name,
                      itemIds: item.itemIds,
                    });
                  }}
                >
                  <Icon>
                  <IoPencil />
                  </Icon>
                </Button>
                </HStack>
              </HStack>
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
