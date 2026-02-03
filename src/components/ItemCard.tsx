import { Card, Text, Stack, Link, Checkbox, HStack } from "@chakra-ui/react";
import { formatNumber } from "../utils/format";
import type { ItemWithStats } from "../db";

interface ItemCardProps {
  item: ItemWithStats;
  disableNavigation?: boolean;
  size?: "default" | "large";
  showSelectionControls?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (itemId: number, isSelected: boolean) => void;
}

export default function ItemCard({
  item,
  disableNavigation = false,
  size = "default",
  showSelectionControls = false,
  isSelected = false,
  onSelectionChange,
}: ItemCardProps) {
  const titleSize = size === "large" ? "2xl" : undefined;
  const textSize = size === "large" ? "md" : "sm";
  const priceSize = size === "large" ? "lg" : "sm";

  return (
    <Link
      href={disableNavigation ? undefined : `/item/${item.id}`}
      display="block"
      width="100%"
      className=""
    >
      <Card.Root
        width="100%"
        maxW="xl"
        height="100%"
        variant="outline"
        cursor={disableNavigation ? "default" : "pointer"}
        _hover={disableNavigation ? {} : { borderColor: "blue.500" }}
        className="item-card "
      >
        <Card.Body>
          <Card.Title
            fontSize={titleSize}
            mb={size === "large" ? 4 : undefined}
          >
            {item.name}
          </Card.Title>
          <HStack justify="space-between">

          <Stack
            gap={size === "default" ? 2 : 3}
            mt={size === "default" ? 2 : 0}
          >
            {item.latestPrice !== null && (
              <Text fontSize={priceSize} fontWeight="medium">
                Latest Price: £{formatNumber(item.latestPrice)}
              </Text>
            )}
            {item.totalQuantity > 0 && (
              <Text fontSize={textSize}>
                Total Bought: {formatNumber(item.totalQuantity)}
              </Text>
            )}
            {item.totalSpent > 0 && (
              <Text fontSize={textSize}>
                Total Spent: £{formatNumber(item.totalSpent)}
              </Text>
            )}
          </Stack>
          {showSelectionControls && (
            <Checkbox.Root
              aria-label={`Select ${item.name}`}
              checked={isSelected}
              onCheckedChange={(e) =>
                onSelectionChange?.(item.id, e.checked === true)
              }
              mt={2}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Root>
          )}
          </HStack>
        </Card.Body>
      </Card.Root>
    </Link>
  );
}
