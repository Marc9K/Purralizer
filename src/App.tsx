import { useState, useEffect } from "react";
import {
  Button,
  VStack,
  Text,
  Box,
  FileUpload,
  ProgressCircle,
  HStack,
  Card,
  SimpleGrid,
} from "@chakra-ui/react";
import { db, type Item } from "./db";

const Status = {
  IDLE: "",
  READING_FILE: "Reading file...",
  PROCESSING_DATA: "Processing data...",
  SUCCESS: "Successfully imported purchases!",
} as const;

interface PurchaseData {
  requestId: string;
  purchases: Array<{
    timestamp: string;
    type: string;
    says: string;
    basketValueGross: number;
    overallBasketSavings: number;
    basketValueNet: number;
    numberOfItems: number;
    payment: Array<{
      type: string;
      category?: string;
      amount: number;
    }>;
    items: Array<{
      name: string;
      quantity: number;
      weight: number;
      price: number;
      volume: number;
    }>;
  }>;
  orders: any[];
}

function App() {
  const [status, setStatus] = useState<string>(Status.IDLE);
  const [items, setItems] = useState<Item[]>([]);

  const loadItems = async () => {
    const allItems = await db.items.toArray();
    setItems(allItems);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleFileAccept = async (details: { files: File[] }) => {
    const file = details.files[0];
    if (!file) return;

    setStatus(Status.READING_FILE);

    try {
      const text = await file.text();
      const data: PurchaseData = JSON.parse(text);

      setStatus(Status.PROCESSING_DATA);

      // Prepare all purchases for bulk insert
      const purchasesToAdd = data.purchases.map((purchase) => ({
        timestamp: purchase.timestamp,
        type: purchase.type,
        says: purchase.says,
        basketValueGross: purchase.basketValueGross,
        overallBasketSavings: purchase.overallBasketSavings,
        basketValueNet: purchase.basketValueNet,
        numberOfItems: purchase.numberOfItems,
        payment: purchase.payment,
      }));

      // Bulk add purchases and get their IDs
      const purchaseIds = (await db.purchases.bulkAdd(purchasesToAdd, {
        allKeys: true,
      })) as unknown as number[];

      // Collect all unique items (deduplicate by name+weight+volume)
      const itemMap = new Map<
        string,
        { name: string; weight: number; volume: number }
      >();
      const itemToPriceMap = new Map<
        string,
        Array<{ purchaseIndex: number; price: number }>
      >();

      data.purchases.forEach((purchase, purchaseIndex) => {
        purchase.items.forEach((item) => {
          const itemKey = `${item.name}|${item.weight}|${item.volume}`;
          if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, {
              name: item.name,
              weight: item.weight,
              volume: item.volume,
            });
          }
          if (!itemToPriceMap.has(itemKey)) {
            itemToPriceMap.set(itemKey, []);
          }
          itemToPriceMap.get(itemKey)!.push({
            purchaseIndex,
            price: item.price,
          });
        });
      });

      // Check which items already exist in the database
      const itemsToAdd: Array<{
        name: string;
        weight: number;
        volume: number;
      }> = [];
      const existingItemMap = new Map<string, number>();

      for (const [itemKey, item] of itemMap.entries()) {
        const existingItem = await db.items
          .where("[name+weight+volume]")
          .equals([item.name, item.weight, item.volume])
          .first();

        if (existingItem && existingItem.id) {
          existingItemMap.set(itemKey, existingItem.id);
        } else {
          itemsToAdd.push(item);
        }
      }

      // Bulk add new items and get their IDs
      if (itemsToAdd.length > 0) {
        const newItemIds = (await db.items.bulkAdd(itemsToAdd, {
          allKeys: true,
        })) as unknown as number[];

        // Map new items to their IDs
        itemsToAdd.forEach((item, index) => {
          const itemKey = `${item.name}|${item.weight}|${item.volume}`;
          existingItemMap.set(itemKey, newItemIds[index]!);
        });
      }

      // Prepare all prices for bulk insert
      const pricesToAdd: Array<{
        purchaseId: number;
        itemId: number;
        price: number;
      }> = [];

      for (const [itemKey, prices] of itemToPriceMap.entries()) {
        const itemId = existingItemMap.get(itemKey);
        if (itemId) {
          prices.forEach(({ purchaseIndex, price }) => {
            pricesToAdd.push({
              purchaseId: purchaseIds[purchaseIndex],
              itemId,
              price,
            });
          });
        }
      }

      // Bulk add prices
      await db.prices.bulkAdd(pricesToAdd);

      setStatus(Status.SUCCESS);
      // Reload items after successful import
      await loadItems();
    } catch (error) {
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  return (
    <Box p={8}>
      <VStack gap={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold">
          Import Purchase Data
        </Text>
        <FileUpload.Root
          accept={{ "application/json": [".json"] }}
          onFileAccept={handleFileAccept}
        >
          <FileUpload.HiddenInput />
          <FileUpload.Trigger asChild>
            <Button colorPalette="black">Select JSON File</Button>
          </FileUpload.Trigger>
        </FileUpload.Root>
        {status !== Status.IDLE && (
          <HStack gap={3}>
            {(status === Status.READING_FILE ||
              status === Status.PROCESSING_DATA) && (
              <ProgressCircle.Root value={null} size="sm">
                <ProgressCircle.Circle>
                  <ProgressCircle.Track />
                  <ProgressCircle.Range />
                </ProgressCircle.Circle>
              </ProgressCircle.Root>
            )}
            <Text
              color={
                status.startsWith("Error")
                  ? "red.500"
                  : status === Status.SUCCESS
                  ? "green.500"
                  : "fg.default"
              }
            >
              {status}
            </Text>
          </HStack>
        )}
        {items.length > 0 && (
          <VStack gap={4} align="stretch" mt={8}>
            <Text fontSize="xl" fontWeight="bold">
              Items ({items.length})
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {items.map((item) => (
                <Card.Root key={item.id} variant="outline">
                  <Card.Body>
                    <Card.Title>{item.name}</Card.Title>
                    <Card.Description>
                      <HStack gap={2} mt={2}>
                        {item.weight > 0 && (
                          <Text fontSize="sm" color="fg.muted">
                            Weight: {item.weight}g
                          </Text>
                        )}
                        {item.volume > 0 && (
                          <Text fontSize="sm" color="fg.muted">
                            Volume: {item.volume}L
                          </Text>
                        )}
                      </HStack>
                    </Card.Description>
                  </Card.Body>
                </Card.Root>
              ))}
            </SimpleGrid>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}

export default App;
