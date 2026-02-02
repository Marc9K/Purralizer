import { Card, Text, Stack, Link } from "@chakra-ui/react";
import { formatNumber } from "../utils/format";
import type { ItemWithStats } from "../db";

interface ItemCardProps {
  item: ItemWithStats;
  disableNavigation?: boolean;
  size?: "default" | "large";
}

export default function ItemCard({
  item,
  disableNavigation = false,
  size = "default",
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
        </Card.Body>
      </Card.Root>
    </Link>
  );
}
