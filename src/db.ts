import Dexie, { type Table } from "dexie";

export interface Purchase {
  id?: number;
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
}

export interface Item {
  id?: number;
  name: string;
  weight: number;
  volume: number;
}

export interface Price {
  id?: number;
  purchaseId: number;
  itemId: number;
  price: number;
}

class PurralizerDB extends Dexie {
  purchases!: Table<Purchase, number>;
  items!: Table<Item, number>;
  prices!: Table<Price, number>;

  constructor() {
    super("PurralizerDB");

    this.version(1).stores({
      purchases:
        "++id, timestamp, numberOfItems, overallBasketSavings, basketValueGross, basketValueNet",
      // Compound index for name+weight+volume as unique identifier
      items: "++id, name, weight, volume, [name+weight+volume]",
      prices: "++id, purchaseId, itemId, price",
    });
  }
}

export const db = new PurralizerDB();
