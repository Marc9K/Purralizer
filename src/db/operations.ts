import { query, insertMany, clearDatabase, runInTransaction } from "../db";

// Types
export interface PurchaseData {
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

export interface ItemWithStats {
  id: number;
  name: string;
  latestPrice: number | null;
  totalQuantity: number;
  totalSpent: number;
  weight?: number;
  volume?: number;
}

export interface PurchaseHistoryItem {
  timestamp: string;
  price: number;
  weight: number | null;
  volume: number | null;
  trueQuantity: number;
  cost: number | null;
}

export interface ChartDataPoint {
  timestamp: string;
  date: number;
  price: number;
  quantityBought: number;
}

export interface DaysBetweenPurchasePoint {
  timestamp: string;
  date: number;
  daysSinceLastPurchase: number | null;
}

export interface DaysBetweenPurchasesResult {
  data: DaysBetweenPurchasePoint[];
  averageDays: number | null;
}

// File import function
export async function importPurchaseData(
  file: File
): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text();
    const data: PurchaseData = JSON.parse(text);

    // Run everything in a single transaction to avoid stack overflow
    await runInTransaction(async () => {
      // Bulk insert all purchases (INSERT OR IGNORE will skip duplicates via UNIQUE INDEX)
      const purchaseParams = data.purchases.map((purchase) => [
        purchase.timestamp ?? null,
        purchase.type ?? null,
        purchase.says ?? null,
        purchase.basketValueGross ?? null,
        purchase.overallBasketSavings ?? null,
        purchase.basketValueNet ?? null,
        purchase.numberOfItems ?? null,
        purchase.payment ? JSON.stringify(purchase.payment) : null,
      ]);

      await insertMany(
        `INSERT OR IGNORE INTO purchases (timestamp, type, says, basketValueGross, overallBasketSavings, basketValueNet, numberOfItems, payment) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        purchaseParams,
        true, // skip save - will save at end of transaction
        true // skip transaction - already in a transaction
      );

      // Get all purchase IDs using the UNIQUE INDEX, only for purchases with no items connected
      const purchaseIds: number[] = [];

      for (const purchase of data.purchases) {
        const results = await query<{ id: number }>(
          `SELECT p.id FROM purchases p
           WHERE p.timestamp = ? AND p.numberOfItems = ? AND p.basketValueGross = ?
           AND (SELECT COUNT(*) FROM amounts WHERE purchaseId = p.id) = 0`,
          [
            purchase.timestamp ?? null,
            purchase.numberOfItems ?? null,
            purchase.basketValueGross ?? null,
          ]
        );
        if (results.length > 0) {
          console.log("found purchaseId", results[0]!.id);
          purchaseIds.push(results[0]!.id);
        } else {
          console.log("no purchaseId found");
          purchaseIds.push(0); // Placeholder for purchases that don't exist or already have items
        }
      }

      // For each purchase, check if it has items connected, if not add them
      for (
        let purchaseIndex = 0;
        purchaseIndex < data.purchases.length;
        purchaseIndex++
      ) {
        const purchase = data.purchases[purchaseIndex];
        const purchaseId = purchaseIds[purchaseIndex];

        if (!purchaseId) continue;

        // If purchase has no items, add them
        if (purchase.items.length > 0) {
          // Collect all unique items and prices for this purchase
          const itemNameToId = new Map<string, number>();
          const priceKeyToId = new Map<string, number>();
          const newItemParams: (string | number | null)[][] = [];
          const newPriceParams: (string | number | null)[][] = [];
          const pricePurchaseParams: (string | number | null)[][] = [];
          const amountParams: (string | number | null)[][] = [];

          // First pass: find existing items and collect new ones
          for (const item of purchase.items) {
            const itemNameLower = item.name.toLowerCase();
            if (!itemNameToId.has(itemNameLower)) {
              const existingItems = await query<{ id: number }>(
                `SELECT id FROM items WHERE LOWER(name) = ?`,
                [itemNameLower]
              );
              if (existingItems.length > 0) {
                itemNameToId.set(itemNameLower, existingItems[0]!.id);
              } else {
                newItemParams.push([item.name]);
              }
            }
          }

          // Bulk insert new items
          if (newItemParams.length > 0) {
            const newItemIds = await insertMany(
              `INSERT INTO items (name) VALUES (?)`,
              newItemParams,
              true, // skip save
              true // skip transaction
            );

            // Map new item IDs to names
            let newItemIndex = 0;
            for (const item of purchase.items) {
              const itemNameLower = item.name.toLowerCase();
              if (!itemNameToId.has(itemNameLower)) {
                itemNameToId.set(itemNameLower, newItemIds[newItemIndex]!);
                newItemIndex++;
              }
            }
          }

          // Second pass: find existing prices and collect new ones, build amount params
          for (const item of purchase.items) {
            const itemNameLower = item.name.toLowerCase();
            const itemId = itemNameToId.get(itemNameLower);
            if (!itemId) continue;

            const priceKey = `${itemId}|${item.price}`;
            if (!priceKeyToId.has(priceKey)) {
              const existingPrices = await query<{ id: number }>(
                `SELECT id FROM prices WHERE itemId = ? AND price = ?`,
                [itemId, item.price]
              );
              if (existingPrices.length > 0) {
                priceKeyToId.set(priceKey, existingPrices[0]!.id);
              } else {
                newPriceParams.push([itemId, item.price]);
              }
            }

            amountParams.push([
              purchaseId,
              itemId,
              item.weight ?? null,
              item.volume ?? null,
              item.quantity,
            ]);
          }

          // Bulk insert new prices
          if (newPriceParams.length > 0) {
            const newPriceIds = await insertMany(
              `INSERT INTO prices (itemId, price) VALUES (?, ?)`,
              newPriceParams,
              true, // skip save
              true // skip transaction
            );

            // Map new price IDs
            let newPriceIndex = 0;
            for (const item of purchase.items) {
              const itemNameLower = item.name.toLowerCase();
              const itemId = itemNameToId.get(itemNameLower);
              if (!itemId) continue;

              const priceKey = `${itemId}|${item.price}`;
              if (!priceKeyToId.has(priceKey)) {
                priceKeyToId.set(priceKey, newPriceIds[newPriceIndex]!);
                newPriceIndex++;
              }
            }
          }

          // Build price_purchases params
          for (const item of purchase.items) {
            const itemNameLower = item.name.toLowerCase();
            const itemId = itemNameToId.get(itemNameLower);
            if (!itemId) continue;

            const priceKey = `${itemId}|${item.price}`;
            const priceId = priceKeyToId.get(priceKey);
            if (priceId) {
              pricePurchaseParams.push([priceId, purchaseId]);
            }
          }

          // Bulk insert price_purchases (with OR IGNORE for duplicates)
          if (pricePurchaseParams.length > 0) {
            try {
              await insertMany(
                `INSERT OR IGNORE INTO price_purchases (priceId, purchaseId) VALUES (?, ?)`,
                pricePurchaseParams,
                true, // skip save
                true // skip transaction
              );
            } catch (error) {
              // Ignore errors from unique constraint
            }
          }

          // Bulk insert amounts
          if (amountParams.length > 0) {
            await insertMany(
              `INSERT INTO amounts (purchaseId, itemId, weight, volume, quantity) VALUES (?, ?, ?, ?, ?)`,
              amountParams,
              true, // skip save
              true // skip transaction
            );
          }
        }
      }
    });

    // Trigger a refresh by dispatching db-update event
    window.dispatchEvent(new Event("db-update"));

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Clear database function
export async function clearAllData(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await clearDatabase();
    // Trigger a refresh
    window.dispatchEvent(new Event("db-update"));
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Query functions

// Get items with stats (for list view)
export async function getItemsWithStats(
  searchQuery: string = "",
  sortField:
    | "totalQuantity"
    | "totalSpent"
    | "latestPrice"
    | "name" = "totalSpent",
  sortDirection: "asc" | "desc" = "desc"
): Promise<ItemWithStats[]> {
  const searchCondition =
    searchQuery && searchQuery.trim() ? `AND LOWER(i.name) LIKE ?` : "";
  const searchParam =
    searchQuery && searchQuery.trim()
      ? [`%${searchQuery.toLowerCase().trim()}%`]
      : [];

  let orderByClause = "";
  switch (sortField) {
    case "totalQuantity":
      orderByClause = "ORDER BY totalQuantity";
      break;
    case "totalSpent":
      orderByClause = "ORDER BY totalSpent";
      break;
    case "latestPrice":
      orderByClause = "ORDER BY latestPrice";
      break;
    case "name":
    default:
      orderByClause = "ORDER BY LOWER(i.name)";
      break;
  }
  orderByClause += sortDirection === "asc" ? " ASC" : " DESC";

  const items = await query<ItemWithStats>(
    `SELECT 
      i.id,
      i.name,
      MAX(CASE 
        WHEN a.weight IS NOT NULL AND a.weight > 0 AND a.weight != 1 
        THEN a.weight 
      END) as weight,
      MAX(CASE 
        WHEN a.volume IS NOT NULL AND a.volume > 0 AND a.volume != 1 
        THEN a.volume 
      END) as volume,
      COALESCE(SUM(COALESCE(a.volume, a.quantity)), 0) as totalQuantity,
      COALESCE(SUM(
        p.price * COALESCE(a.volume, a.quantity)
      ), 0) as totalSpent,
      (
        SELECT p2.price 
        FROM price_purchases pp2
        JOIN prices p2 ON pp2.priceId = p2.id
        JOIN purchases pur2 ON pp2.purchaseId = pur2.id
        WHERE p2.itemId = i.id
        ORDER BY pur2.timestamp DESC
        LIMIT 1
      ) as latestPrice
    FROM items i
    LEFT JOIN price_purchases pp ON pp.priceId IN (
      SELECT id FROM prices WHERE itemId = i.id
    )
    LEFT JOIN prices p ON pp.priceId = p.id
    LEFT JOIN purchases pur ON pp.purchaseId = pur.id
    LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = i.id
    WHERE 1=1 ${searchCondition}
    GROUP BY i.id, i.name
    ${orderByClause}`,
    searchParam
  );

  return items.map((item) => ({
    ...item,
    weight: item.weight ?? undefined,
    volume: item.volume ?? undefined,
    latestPrice: item.latestPrice ?? null,
    totalQuantity: item.totalQuantity ?? 0,
    totalSpent: item.totalSpent ?? 0,
  }));
}

// Get item with stats (for detail view)
export async function getItemWithStats(
  itemId: number
): Promise<ItemWithStats | undefined> {
  const items = await query<{ id: number; name: string }>(
    `SELECT id, name FROM items WHERE id = ?`,
    [itemId]
  );
  if (items.length === 0) return undefined;

  const item = items[0]!;

  const stats = await query<{
    latestPrice: number | null;
    totalQuantity: number;
    totalSpent: number;
    weight: number | null;
    volume: number | null;
  }>(
    `SELECT 
      MAX(CASE 
        WHEN a.weight IS NOT NULL AND a.weight > 0 AND a.weight != 1 
        THEN a.weight 
      END) as weight,
      MAX(CASE 
        WHEN a.volume IS NOT NULL AND a.volume > 0 AND a.volume != 1 
        THEN a.volume 
      END) as volume,
      COALESCE(SUM(COALESCE(a.volume, a.quantity)), 0) as totalQuantity,
      COALESCE(SUM(
        p.price * COALESCE(a.volume, a.quantity)
      ), 0) as totalSpent,
      (
        SELECT p2.price 
        FROM price_purchases pp2
        JOIN prices p2 ON pp2.priceId = p2.id
        JOIN purchases pur2 ON pp2.purchaseId = pur2.id
        WHERE p2.itemId = ?
        ORDER BY pur2.timestamp DESC
        LIMIT 1
      ) as latestPrice
    FROM items i
    LEFT JOIN price_purchases pp ON pp.priceId IN (
      SELECT id FROM prices WHERE itemId = i.id
    )
    LEFT JOIN prices p ON pp.priceId = p.id
    LEFT JOIN purchases pur ON pp.purchaseId = pur.id
    LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = i.id
    WHERE i.id = ?
    GROUP BY i.id`,
    [item.id, item.id]
  );

  const stat = stats[0]!;
  console.log(stat);

  return {
    ...item,
    latestPrice: stat.latestPrice,
    totalQuantity: stat.totalQuantity,
    totalSpent: stat.totalSpent,
    weight: stat.weight ?? undefined,
    volume: stat.volume ?? undefined,
  };
}

// Get purchase history for an item
export async function getItemPurchaseHistory(
  itemId: number
): Promise<PurchaseHistoryItem[]> {
  const history = await query<PurchaseHistoryItem>(
    `SELECT 
      pur.timestamp, 
      p.price, 
      a.weight, 
      a.volume, 
      COALESCE(a.volume, a.quantity) as trueQuantity,
      CASE 
        WHEN COALESCE(a.volume, a.quantity) != 1 AND COALESCE(a.volume, a.quantity) > 0
        THEN p.price * COALESCE(a.volume, a.quantity)
        ELSE NULL
      END as cost
     FROM price_purchases pp
     JOIN prices p ON pp.priceId = p.id
     JOIN purchases pur ON pp.purchaseId = pur.id
     LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = p.itemId
     WHERE p.itemId = ?
     ORDER BY pur.timestamp DESC`,
    [itemId]
  );
  return history;
}

// Get chart data for an item
export async function getItemChartData(
  itemId: number
): Promise<ChartDataPoint[]> {
  const history = await getItemPurchaseHistory(itemId);

  return history
    .slice()
    .reverse()
    .map((purchase) => {
      const date = new Date(purchase.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const timestamp = `${year}-${month}-${day} ${hours}:${minutes}`;

      return {
        timestamp,
        date: date.getTime(),
        price: purchase.price,
        quantityBought: purchase.trueQuantity,
      };
    });
}

// Get total spent across all purchases
export async function getTotalSpent(): Promise<number> {
  const result = await query<{ total: number | null }>(
    `SELECT SUM(p.price * COALESCE(a.volume, a.quantity)) as total 
     FROM price_purchases pp
     JOIN prices p ON pp.priceId = p.id
     JOIN purchases pur ON pp.purchaseId = pur.id
     LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = p.itemId`
  );
  return result[0]?.total ?? 0;
}

// Get total items count
export async function getTotalItemsCount(): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM items`
  );
  return result[0]?.count ?? 0;
}

// Get days between purchases data for an item
export async function getDaysBetweenPurchasesData(
  itemId: number,
  excludeTopN: number = 0
): Promise<DaysBetweenPurchasesResult> {
  // Use a CTE to calculate days, then exclude top N by daysSinceLastPurchase, and calculate average
  const result = await query<{
    timestamp: string;
    daysSinceLastPurchase: number | null;
    averageDays: number | null;
  }>(
    `WITH purchase_days AS (
      SELECT 
        pur.timestamp,
        CASE 
          WHEN LAG(pur.timestamp) OVER (ORDER BY pur.timestamp) IS NOT NULL
          THEN julianday(pur.timestamp) - julianday(LAG(pur.timestamp) OVER (ORDER BY pur.timestamp))
          ELSE NULL
        END as daysSinceLastPurchase
      FROM price_purchases pp
      JOIN prices p ON pp.priceId = p.id
      JOIN purchases pur ON pp.purchaseId = pur.id
      WHERE p.itemId = ?
    ),
    ranked_purchases AS (
      SELECT 
        timestamp,
        daysSinceLastPurchase,
        ROW_NUMBER() OVER (
          ORDER BY 
            CASE 
              WHEN daysSinceLastPurchase IS NULL THEN 0 
              ELSE 1 
            END,
            daysSinceLastPurchase DESC
        ) as rank_order
      FROM purchase_days
      WHERE daysSinceLastPurchase IS NOT NULL
    ),
    filtered_purchases AS (
      SELECT 
        pd.timestamp,
        pd.daysSinceLastPurchase
      FROM purchase_days pd
      LEFT JOIN ranked_purchases rp ON pd.timestamp = rp.timestamp 
        AND pd.daysSinceLastPurchase = rp.daysSinceLastPurchase
      WHERE pd.daysSinceLastPurchase IS NULL 
         OR rp.rank_order IS NULL 
         OR rp.rank_order > ?
    )
    SELECT 
      fp.timestamp,
      fp.daysSinceLastPurchase,
      (
        SELECT AVG(daysSinceLastPurchase)
        FROM filtered_purchases
        WHERE daysSinceLastPurchase IS NOT NULL
      ) as averageDays
    FROM filtered_purchases fp
    ORDER BY fp.timestamp ASC`,
    [itemId, excludeTopN]
  );

  const data = result.map((row) => {
    const date = new Date(row.timestamp);
    return {
      timestamp: row.timestamp,
      date: date.getTime(),
      daysSinceLastPurchase: row.daysSinceLastPurchase,
    };
  });

  const averageDays = result.length > 0 ? result[0]?.averageDays ?? null : null;

  return {
    data,
    averageDays,
  };
}
