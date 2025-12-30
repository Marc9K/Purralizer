import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

export interface Purchase {
  id?: number;
  timestamp: string;
  type?: string;
  says?: string;
  basketValueGross?: number;
  overallBasketSavings?: number;
  basketValueNet?: number;
  numberOfItems?: number;
  payment: Array<{
    type: string;
    category?: string;
    amount: number;
  }>;
}

export interface Item {
  id?: number;
  name: string;
}

export interface Price {
  id?: number;
  itemId: number;
  price: number;
}

export interface Amount {
  id?: number;
  purchaseId: number;
  itemId: number;
  weight?: number;
  volume?: number;
  quantity: number;
}

export interface PricePurchase {
  priceId: number;
  purchaseId: number;
}

// Re-export types from operations for convenience
export type {
  ItemWithStats,
  PurchaseHistoryItem,
  ChartDataPoint,
} from "./db/operations";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbInitialized = false;

const DB_KEY = "purralizer_db";

function createTables(database: Database): void {
  // Create tables
  database.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      type TEXT,
      says TEXT,
      basketValueGross REAL,
      overallBasketSavings REAL,
      basketValueNet REAL,
      numberOfItems INTEGER,
      payment TEXT
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (itemId) REFERENCES items(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS amounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseId INTEGER NOT NULL,
      itemId INTEGER NOT NULL,
      weight REAL,
      volume REAL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (purchaseId) REFERENCES purchases(id),
      FOREIGN KEY (itemId) REFERENCES items(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS price_purchases (
      priceId INTEGER NOT NULL,
      purchaseId INTEGER NOT NULL,
      PRIMARY KEY (priceId, purchaseId),
      FOREIGN KEY (priceId) REFERENCES prices(id),
      FOREIGN KEY (purchaseId) REFERENCES purchases(id)
    )
  `);

  // Create indexes for performance
  database.run(
    `CREATE INDEX IF NOT EXISTS idx_purchases_timestamp ON purchases(timestamp)`
  );
  database.run(`CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)`);
  database.run(
    `CREATE INDEX IF NOT EXISTS idx_prices_itemId ON prices(itemId)`
  );
  database.run(
    `CREATE INDEX IF NOT EXISTS idx_amounts_purchaseId ON amounts(purchaseId)`
  );
  database.run(
    `CREATE INDEX IF NOT EXISTS idx_amounts_itemId ON amounts(itemId)`
  );
  database.run(
    `CREATE INDEX IF NOT EXISTS idx_price_purchases_priceId ON price_purchases(priceId)`
  );
  database.run(
    `CREATE INDEX IF NOT EXISTS idx_price_purchases_purchaseId ON price_purchases(purchaseId)`
  );

  // Create unique index for purchase uniqueness (timestamp, numberOfItems, basketValueGross)
  database.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_unique ON purchases(timestamp, numberOfItems, basketValueGross)`
  );
}

async function initDatabase(): Promise<Database> {
  if (db && dbInitialized) {
    return db;
  }

  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }

  // Try to load existing database from localStorage
  const savedDb = localStorage.getItem(DB_KEY);
  if (savedDb) {
    const uint8Array = Uint8Array.from(atob(savedDb), (c) => c.charCodeAt(0));
    db = new SQL.Database(uint8Array);
  } else {
    db = new SQL.Database();
  }

  // Always ensure tables exist (CREATE IF NOT EXISTS handles both new and existing databases)
  createTables(db);

  if (!savedDb) {
    saveDatabase();
  }

  dbInitialized = true;
  return db;
}

function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  // Convert Uint8Array to base64 in chunks to avoid stack overflow
  // Build string character by character to avoid spreading large arrays
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  const base64 = btoa(binary);
  localStorage.setItem(DB_KEY, base64);
}

// Initialize database on module load
let initPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!initPromise) {
    initPromise = initDatabase();
  }
  return initPromise;
}

export async function clearDatabase(): Promise<void> {
  const database = await getDb();
  // Drop tables in reverse order of dependencies
  database.run(`DROP TABLE IF EXISTS price_purchases`);
  database.run(`DROP TABLE IF EXISTS amounts`);
  database.run(`DROP TABLE IF EXISTS prices`);
  database.run(`DROP TABLE IF EXISTS items`);
  database.run(`DROP TABLE IF EXISTS purchases`);

  // Recreate tables
  createTables(database);

  saveDatabase();
}

// Helper function to execute queries and return results
export async function query<T>(
  sql: string,
  params: (string | number)[] = []
): Promise<T[]> {
  const database = await getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper function to execute a single insert and return the last insert ID
export async function insert(
  sql: string,
  params: (string | number | null)[] = [],
  skipSave: boolean = false
): Promise<number> {
  const database = await getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  stmt.step();
  const lastId = database.exec("SELECT last_insert_rowid() as id")[0]
    ?.values[0]?.[0] as number;
  stmt.free();
  if (!skipSave) {
    saveDatabase();
  }
  return lastId;
}

// Helper function to execute multiple inserts in a transaction
export async function insertMany(
  sql: string,
  paramsArray: (string | number | null)[][],
  skipSave: boolean = false,
  skipTransaction: boolean = false
): Promise<number[]> {
  const database = await getDb();
  const stmt = database.prepare(sql);
  const ids: number[] = [];
  let transactionStarted = false;

  try {
    if (!skipTransaction) {
      database.run("BEGIN TRANSACTION");
      transactionStarted = true;
    }

    for (const params of paramsArray) {
      stmt.bind(params);
      stmt.step();
      stmt.reset();
      const lastId = database.exec("SELECT last_insert_rowid() as id")[0]
        ?.values[0]?.[0] as number;
      ids.push(lastId);
    }

    if (!skipTransaction) {
      database.run("COMMIT");
      transactionStarted = false;
      if (!skipSave) {
        saveDatabase();
      }
    }
  } catch (error) {
    if (transactionStarted) {
      try {
        database.run("ROLLBACK");
      } catch (rollbackError) {
        // Ignore rollback errors (e.g., if transaction was already committed)
      }
    }
    throw error;
  } finally {
    stmt.free();
  }

  return ids;
}

// Helper function to run operations in a transaction and save only at the end
export async function runInTransaction<T>(
  operations: () => Promise<T>
): Promise<T> {
  const database = await getDb();
  let transactionStarted = false;

  try {
    database.run("BEGIN TRANSACTION");
    transactionStarted = true;

    const result = await operations();

    database.run("COMMIT");
    transactionStarted = false;
    saveDatabase();

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        database.run("ROLLBACK");
      } catch (rollbackError) {
        // Ignore rollback errors
      }
    }
    throw error;
  }
}

// Functions are already exported above
