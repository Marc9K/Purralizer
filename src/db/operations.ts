import {
  query,
  insert,
  insertMany,
  clearDatabase,
  runInTransaction,
} from "../db";

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

// File import function
export async function importPurchaseData(
  file: File
): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text();
    const data: PurchaseData = JSON.parse(text);

    // Run everything in a single transaction to avoid stack overflow
    await runInTransaction(async () => {
      // Insert purchases in bulk and get their IDs
      // Convert undefined values to null for SQL
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
      const purchaseIds = await insertMany(
        `INSERT INTO purchases (timestamp, type, says, basketValueGross, overallBasketSavings, basketValueNet, numberOfItems, payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        purchaseParams,
        true, // skip save - will save at end of transaction
        true // skip transaction - already in a transaction
      );

      // Process each purchase's items
      for (
        let purchaseIndex = 0;
        purchaseIndex < data.purchases.length;
        purchaseIndex++
      ) {
        const purchase = data.purchases[purchaseIndex];
        const purchaseId = purchaseIds[purchaseIndex]!;

        for (const item of purchase.items) {
          // Find or create item by name (case-insensitive)
          const existingItems = await query<{ id: number; name: string }>(
            `SELECT id, name FROM items WHERE LOWER(name) = LOWER(?)`,
            [item.name]
          );

          let itemId: number;
          if (existingItems.length > 0) {
            itemId = existingItems[0]!.id;
          } else {
            itemId = await insert(
              `INSERT INTO items (name) VALUES (?)`,
              [item.name],
              true // skip save
            );
          }

          // Find or create price by item name and price value
          const existingPrices = await query<{
            id: number;
            itemId: number;
            price: number;
          }>(
            `SELECT p.id, p.itemId, p.price 
             FROM prices p 
             JOIN items i ON p.itemId = i.id 
             WHERE LOWER(i.name) = LOWER(?) AND p.price = ?`,
            [item.name, item.price]
          );

          let priceId: number;
          if (existingPrices.length > 0) {
            priceId = existingPrices[0]!.id;
          } else {
            priceId = await insert(
              `INSERT INTO prices (itemId, price) VALUES (?, ?)`,
              [itemId, item.price],
              true // skip save
            );
          }

          // Link price to purchase (many-to-many)
          try {
            await insert(
              `INSERT INTO price_purchases (priceId, purchaseId) VALUES (?, ?)`,
              [priceId, purchaseId],
              true // skip save
            );
          } catch (error) {
            // Ignore if already exists (unique constraint)
          }

          // Insert amount record (handle undefined weight/volume as NULL)
          await insert(
            `INSERT INTO amounts (purchaseId, itemId, weight, volume, quantity) VALUES (?, ?, ?, ?, ?)`,
            [
              purchaseId,
              itemId,
              item.weight ?? null,
              item.volume ?? null,
              item.quantity,
            ],
            true // skip save
          );
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
