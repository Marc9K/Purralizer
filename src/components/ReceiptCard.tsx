import {
  Card,
  Checkbox,
  HStack,
  Icon,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import type { Receipt } from "../db/operations";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatTime,
} from "../utils/format";

type ReceiptCardProps = {
  receipt: Receipt;
  defaultExpanded: boolean;
  onExcludedChange: (receiptId: number, excluded: boolean) => void;
};

export default function ReceiptCard({
  receipt,
  defaultExpanded,
  onExcludedChange,
}: ReceiptCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = () => setExpanded((prev) => !prev);
  const excluded = receipt.excluded;

  return (
    <Card.Root
      width="100%"
      variant="outline"
      cursor="pointer"
      // Excluded receipts are still listed, so they say what they are at a
      // glance: a dashed outline and a struck through total.
      borderStyle={excluded ? "dashed" : "solid"}
      _hover={{ borderColor: "blue.500" }}
      className="data-card"
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      }}
    >
      <Card.Body>
        <HStack justify="space-between" align="baseline" gap={3}>
          <VStack align="start" gap={0}>
            <Card.Title>{formatDate(receipt.timestamp)}</Card.Title>
            <Text fontSize="xs" color="fg.muted">
              {formatTime(receipt.timestamp)}
            </Text>
          </VStack>
          <HStack gap={2} align="center">
            <Text
              fontSize="lg"
              fontWeight="bold"
              color={excluded ? "fg.muted" : undefined}
              textDecoration={excluded ? "line-through" : undefined}
            >
              {formatCurrency(receipt.total)}
            </Text>
            <Icon color="fg.muted" aria-hidden>
              {expanded ? <IoChevronUp /> : <IoChevronDown />}
            </Icon>
          </HStack>
        </HStack>

        {/* Only offered on an open card; a collapsed one still shows that it is
            excluded through its dashed border and struck through total. */}
        {expanded && (
          <Checkbox.Root
            mt={3}
            size="sm"
            checked={excluded}
            onCheckedChange={(details) =>
              onExcludedChange(receipt.id, details.checked === true)
            }
            // The whole card collapses on click and on Enter/Space, so the
            // checkbox has to keep its own clicks and keys to itself.
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label
              fontSize="xs"
              fontWeight="normal"
              color={excluded ? "fg" : "fg.muted"}
            >
              Exclude from chart and totals
            </Checkbox.Label>
          </Checkbox.Root>
        )}

        {expanded &&
          (receipt.positions.length === 0 ? (
            <Text mt={4} fontSize="sm" color="fg.muted">
              No positions recorded for this receipt.
            </Text>
          ) : (
            <Table.Root className="data-table" mt={4} size="sm">
              <Table.Header className="data-table">
                <Table.Row className="data-table">
                  <Table.ColumnHeader className="data-table">
                    Item
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end" className="data-table">
                    Qty
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end" className="data-table">
                    Price
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end" className="data-table">
                    Cost
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body className="data-table">
                {receipt.positions.map((position, index) => (
                  <Table.Row
                    key={`${position.itemId}-${index}`}
                    className="data-table"
                  >
                    <Table.Cell className="data-table">
                      {position.name}
                    </Table.Cell>
                    <Table.Cell textAlign="end" className="data-table">
                      {formatNumber(position.quantity)}
                    </Table.Cell>
                    <Table.Cell textAlign="end" className="data-table">
                      {formatCurrency(position.price)}
                    </Table.Cell>
                    <Table.Cell textAlign="end" className="data-table">
                      {formatCurrency(position.cost)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          ))}
      </Card.Body>
    </Card.Root>
  );
}
