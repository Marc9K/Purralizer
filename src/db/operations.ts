import {
  query,
  insert,
  insertMany,
  clearDatabase,
  runInTransaction,
  execute,
} from "../db";
// @ts-ignore - xlsx/xlsx.mjs doesn't have types but works at runtime
import * as XLSX from "xlsx/xlsx.mjs";

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

// XLSX import function
export async function importPurchaseDataFromXLSX(
  file: File
): Promise<{ success: boolean; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Find the sheet named "Transactions (Nectar Card)"
    const sheetName = "Transactions (Nectar Card)";
    if (!workbook.SheetNames.includes(sheetName)) {
      return {
        success: false,
        error: `Sheet "${sheetName}" not found in the Excel file`,
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    }) as any[][];

    // Find the row starting with "Transaction Item" in column A
    let headerRowIndex = -1;
    // for (let i = 0; i < data.length; i++) {
    //   const cellValue = data[i]?.[0];
    //   if (
    //     cellValue &&
    //     String(cellValue).toLowerCase().startsWith("transaction item")
    //   ) {
    //     headerRowIndex = i;
    //     break;
    //   }
    // }

    headerRowIndex = data.findIndex(
      (row) =>
        row[0] && String(row[0]).toLowerCase().startsWith("transaction item")
    );

    if (headerRowIndex === -1) {
      return {
        success: false,
        error: 'Row starting with "Transaction Item" not found in column A',
      };
    }

    // Start reading from headerRowIndex + 2 (skip 2 rows)
    const dataStartRow = headerRowIndex + 2;
    const purchasesMap = new Map<string, PurchaseData["purchases"][0]>();

    // Parse rows
    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      // Get values from columns: A (date), B (time), D (item name), G (weight/volume), J (unit price), M (quantity)
      const dateValue = row[0]; // Column A
      const timeValue = row[1]; // Column B
      const itemName = row[3]; // Column D
      const quantity = row[8]; // Column I
      const unitPrice = row[9]; // Column J
      const cost = row[10]; // Column K
      const discount = row[11]; // Column L
      const weightVolumeValue =
        quantity == 1 && unitPrice != cost && unitPrice != cost + discount
          ? cost / unitPrice
          : null; // Column G or H

      // Skip rows with missing essential data
      if (
        !dateValue ||
        !itemName ||
        unitPrice === null ||
        unitPrice === undefined ||
        quantity === null ||
        quantity === undefined
      ) {
        continue;
      }

      // Parse date and time
      let timestamp: string;
      try {
        // Handle different date formats
        let date: Date;
        if (dateValue instanceof Date) {
          date = new Date(dateValue);
        } else if (typeof dateValue === "number") {
          // Excel serial date (days since 1900-01-01)
          // Excel epoch is 1899-12-30
          const excelEpoch = new Date(1899, 11, 30);
          const msSinceExcelEpoch = dateValue * 86400000;
          date = new Date(excelEpoch.getTime() + msSinceExcelEpoch);
        } else {
          // Try parsing as string
          const dateStr = String(dateValue).trim();
          date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            // Try parsing as Excel date number string
            const numValue = parseFloat(dateStr);
            if (!isNaN(numValue)) {
              const excelEpoch = new Date(1899, 11, 30);
              const msSinceExcelEpoch = numValue * 86400000;
              date = new Date(excelEpoch.getTime() + msSinceExcelEpoch);
            } else {
              continue; // Skip invalid dates
            }
          }
        }

        // Parse time
        let hours = 0,
          minutes = 0,
          seconds = 0;
        if (timeValue !== null && timeValue !== undefined) {
          if (typeof timeValue === "number") {
            // Excel time (fraction of day)
            const totalSeconds = Math.round(timeValue * 86400);
            hours = Math.floor(totalSeconds / 3600);
            minutes = Math.floor((totalSeconds % 3600) / 60);
            seconds = totalSeconds % 60;
          } else {
            // Try parsing time string (HH:MM:SS or HH:MM)
            const timeStr = String(timeValue).trim();
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (timeMatch) {
              hours = parseInt(timeMatch[1]!, 10);
              minutes = parseInt(timeMatch[2]!, 10);
              seconds = timeMatch[3] ? parseInt(timeMatch[3]!, 10) : 0;
            }
          }
        }

        // Set time on date
        date.setHours(hours, minutes, seconds, 0);

        // Format as ISO string
        timestamp = date.toISOString();
      } catch (error) {
        console.warn("Error parsing date/time:", error, dateValue, timeValue);
        continue;
      }

      // Parse numeric values
      const price = parseFloat(
        String(discount != 0 ? cost / quantity : unitPrice)
      );
      const qty = parseFloat(String(quantity));

      if (isNaN(price) || isNaN(qty) || price < 0 || qty <= 0) {
        continue;
      }

      // Parse weight/volume from column G
      let weight: number = 0;
      let volume: number = 0;
      if (weightVolumeValue !== null && weightVolumeValue !== undefined) {
        const weightVolume = parseFloat(String(weightVolumeValue));
        if (!isNaN(weightVolume) && weightVolume > 0) {
          // Use the value as volume (since volume is used in quantity calculations)
          volume = weightVolume;
          // Also set as weight if it makes sense (you can adjust this logic if needed)
          weight = weightVolume;
        }
      }

      // Group items by transaction (same timestamp)
      if (!purchasesMap.has(timestamp)) {
        purchasesMap.set(timestamp, {
          timestamp,
          type: "",
          says: "",
          basketValueGross: 0,
          overallBasketSavings: 0,
          basketValueNet: 0,
          numberOfItems: 0,
          payment: [],
          items: [],
        });
      }

      const purchase = purchasesMap.get(timestamp)!;
      purchase.items.push({
        name: String(itemName).trim(),
        quantity: qty,
        weight: weight,
        price: price,
        volume: volume,
      });
    }

    // Calculate totals for each purchase
    const purchases = Array.from(purchasesMap.values()).map((purchase) => {
      const basketValueGross = purchase.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      return {
        ...purchase,
        basketValueGross,
        basketValueNet: basketValueGross,
        numberOfItems: purchase.items.length,
      };
    });

    // Create PurchaseData object
    const purchaseData: PurchaseData = {
      requestId: "",
      purchases,
      orders: [],
    };

    // Use the existing import logic
    return await importPurchaseDataFromObject(purchaseData);
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Helper function to import PurchaseData object (extracted from importPurchaseData)
async function importPurchaseDataFromObject(
  data: PurchaseData
): Promise<{ success: boolean; error?: string }> {
  try {
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
          // console.log("found purchaseId", results[0]!.id);
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

// File import function
export async function importPurchaseData(
  file: File
): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text();
    const data: PurchaseData = JSON.parse(text);
    return await importPurchaseDataFromObject(data);
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

// Combined items: CRUD and aggregated data

export interface CombinedItemRecord {
  id: number;
  name: string;
  createdAt: string;
  totalSpent: number;
  itemIds: number[];
}

/** Create a combined item with the given name and linked item IDs. Returns the new combined item id. */
export async function createCombinedItem(
  name: string,
  itemIds: number[]
): Promise<number> {
  if (itemIds.length === 0) {
    throw new Error("At least one item must be selected");
  }
  return await runInTransaction(async () => {
    const createdAt = new Date().toISOString();
    const id = await insert(
      "INSERT INTO combined_items (name, createdAt) VALUES (?, ?)",
      [name, createdAt],
      true
    );
    if (itemIds.length > 0) {
      const linkParams = itemIds.map((itemId) => [id, itemId]);
      await insertMany(
        "INSERT INTO combined_item_links (combinedItemId, itemId) VALUES (?, ?)",
        linkParams,
        true,
        true
      );
    }
    return id;
  });
}

/** List all combined items. */
export async function getCombinedItems(
  sortField: "name" | "totalSpent" = "totalSpent",
  sortDirection: "asc" | "desc" = "desc"
): Promise<CombinedItemRecord[]> {
  type CombinedItemRow = Omit<CombinedItemRecord, "itemIds"> & {
    itemIdList: string | null;
  };
  const orderByClause =
    sortField === "name"
      ? `ci.name ${sortDirection}`
      : `totalSpent ${sortDirection}`;
  const rows = await query<CombinedItemRow>(
    `SELECT 
      ci.id,
      ci.name,
      ci.createdAt,
      COALESCE(GROUP_CONCAT(cil.itemId, ','), '') as itemIdList,
      COALESCE(GROUP_CONCAT(a.quantity, ','), '') as quantityList,
      COALESCE(GROUP_CONCAT(a.volume, ','), '') as volumeList,
      COALESCE(SUM(
        p.price * CASE
            WHEN a.volume IS NOT NULL AND a.volume != 0 THEN a.volume
            WHEN a.quantity IS NOT NULL AND a.quantity != 0 THEN a.quantity
            ELSE 1
          END
      ), 0) as totalSpent
    FROM combined_items ci
    LEFT JOIN combined_item_links cil ON cil.combinedItemId = ci.id
    LEFT JOIN prices p ON p.itemId = cil.itemId
    LEFT JOIN price_purchases pp ON pp.priceId = p.id
    LEFT JOIN purchases pur ON pp.purchaseId = pur.id
    LEFT JOIN amounts a ON a.purchaseId = pur.id AND a.itemId = p.itemId
    GROUP BY ci.id, ci.name, ci.createdAt
    ORDER BY ${orderByClause}`
  );
  console.log(rows);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    totalSpent: row.totalSpent,
    itemIds: row.itemIdList
      ? row.itemIdList
          .split(",")
          .map((value) => Number(value))
          .filter((value) => !Number.isNaN(value))
      : [],
  }));
}

/** Delete a combined item and its links. */
export async function deleteCombinedItem(combinedItemId: number): Promise<void> {
  await runInTransaction(async () => {
    await execute(
      "DELETE FROM combined_item_links WHERE combinedItemId = ?",
      [combinedItemId],
      true
    );
    await execute("DELETE FROM combined_items WHERE id = ?", [combinedItemId], true);
  });
}

/** Update a combined item name and linked item IDs. */
export async function updateCombinedItem(
  combinedItemId: number,
  name: string,
  itemIds: number[]
): Promise<void> {
  const uniqueItemIds = Array.from(new Set(itemIds));
  if (uniqueItemIds.length === 0) {
    throw new Error("At least one item must be selected");
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Name is required");
  }
  await runInTransaction(async () => {
    await execute(
      "UPDATE combined_items SET name = ? WHERE id = ?",
      [trimmedName, combinedItemId],
      true
    );
    await execute(
      "DELETE FROM combined_item_links WHERE combinedItemId = ?",
      [combinedItemId],
      true
    );
    const linkParams = uniqueItemIds.map((itemId) => [
      combinedItemId,
      itemId,
    ]);
    await insertMany(
      "INSERT INTO combined_item_links (combinedItemId, itemId) VALUES (?, ?)",
      linkParams,
      true,
      true
    );
  });
}

/** Get linked item IDs for a combined item. */
async function getCombinedItemLinkIds(combinedItemId: number): Promise<number[]> {
  const rows = await query<{ itemId: number }>(
    `SELECT itemId FROM combined_item_links WHERE combinedItemId = ? ORDER BY itemId`,
    [combinedItemId]
  );
  return rows.map((r) => r.itemId);
}

/** Combined item with same stats shape as ItemWithStats for display (id is combined item id). */
export interface CombinedItemWithStats extends ItemWithStats {}

/** Get a combined item with aggregated stats (sum totals; latestPrice = most recent purchase across linked items). */
export async function getCombinedItemWithStats(
  combinedItemId: number
): Promise<CombinedItemWithStats | undefined> {
  const rows = await query<{ id: number; name: string; createdAt: string }>(
    `SELECT id, name, createdAt FROM combined_items WHERE id = ?`,
    [combinedItemId]
  );
  if (rows.length === 0) return undefined;
  const combined = rows[0]!;
  const itemIds = await getCombinedItemLinkIds(combinedItemId);
  if (itemIds.length === 0) {
    return {
      id: combined.id,
      name: combined.name,
      latestPrice: null,
      totalQuantity: 0,
      totalSpent: 0,
    };
  }

  let totalQuantity = 0;
  let totalSpent = 0;
  let latestPrice: number | null = null;
  let latestTimestamp: string | null = null;

  for (const itemId of itemIds) {
    const stats = await getItemWithStats(itemId);
    if (stats) {
      totalQuantity += stats.totalQuantity;
      totalSpent += stats.totalSpent;
    }
    const history = await getItemPurchaseHistory(itemId);
    for (const h of history) {
      if (
        !latestTimestamp ||
        (h.timestamp !== null && h.timestamp > latestTimestamp)
      ) {
        latestTimestamp = h.timestamp;
        latestPrice = h.price;
      }
    }
  }

  return {
    id: combined.id,
    name: combined.name,
    latestPrice,
    totalQuantity,
    totalSpent,
  };
}

/** Merged purchase history for a combined item (all linked items, sorted by timestamp DESC). */
export async function getCombinedItemPurchaseHistory(
  combinedItemId: number
): Promise<PurchaseHistoryItem[]> {
  const itemIds = await getCombinedItemLinkIds(combinedItemId);
  const all: PurchaseHistoryItem[] = [];
  for (const itemId of itemIds) {
    const history = await getItemPurchaseHistory(itemId);
    all.push(...history);
  }
  all.sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0));
  return all;
}

/** Merged chart data: one point per timestamp, quantity summed, price = weighted average by quantity. */
export async function getCombinedItemChartData(
  combinedItemId: number
): Promise<ChartDataPoint[]> {
  const history = await getCombinedItemPurchaseHistory(combinedItemId);
  // Group by timestamp (string key)
  const byTimestamp = new Map<
    string,
    { totalQty: number; weightedSum: number }
  >();
  console.log(history);
  for (const p of history) {
    const key = p.timestamp;
    const qty = p.trueQuantity;
    const weighted = p.price * qty;
    const existing = byTimestamp.get(key);
    if (existing) {
      existing.totalQty += qty;
      existing.weightedSum += weighted;
    } else {
      byTimestamp.set(key, { totalQty: qty, weightedSum: weighted });
    }
  }
  console.log(byTimestamp);
  const points: ChartDataPoint[] = [];
  for (const [timestamp, agg] of byTimestamp) {
    const date = new Date(timestamp);
    const price = agg.totalQty > 0 ? agg.weightedSum / agg.totalQty : 0;
    points.push({
      timestamp,
      date: date.getTime(),
      price,
      quantityBought: agg.totalQty,
    });
  }
  points.sort((a, b) => a.date - b.date);
  console.log(points);
  return points;
}

/** Days-between-purchases for combined item: unique purchase timestamps across linked items, then same logic. */
export async function getCombinedItemDaysBetweenPurchasesData(
  combinedItemId: number,
  excludeTopN: number = 0
): Promise<DaysBetweenPurchasesResult> {
  const history = await getCombinedItemPurchaseHistory(combinedItemId);
  const timestamps = [...new Set(history.map((h) => h.timestamp))].sort();
  if (timestamps.length === 0) {
    return { data: [], averageDays: null };
  }

  const daysBetween: DaysBetweenPurchasePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]!;
    const date = new Date(ts);
    let daysSinceLastPurchase: number | null = null;
    if (i > 0) {
      const prevDate = new Date(timestamps[i - 1]!);
      daysSinceLastPurchase =
        (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    }
    daysBetween.push({
      timestamp: ts,
      date: date.getTime(),
      daysSinceLastPurchase,
    });
  }

  const daysBetweenSorted = [...daysBetween].sort((a, b) => (b.daysSinceLastPurchase ?? 0) - (a.daysSinceLastPurchase ?? 0));
  const withDays = daysBetweenSorted.filter((d) => d.daysSinceLastPurchase != null);

  const excluded = withDays.slice(excludeTopN);
  const sum = excluded.reduce(
    (acc, d) => acc + (d.daysSinceLastPurchase ?? 0),
    0
  );
  const averageDays =
    excluded.length > 0 ? sum / excluded.length : null;

  return {
    data: excluded.sort((a, b) => a.date - b.date),
    averageDays,
  };
}
