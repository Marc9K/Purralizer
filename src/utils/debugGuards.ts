/**
 * Temporary debugging guards.
 *
 * These turn two opaque failures into loud, located ones:
 *   - `.toLowerCase()` called on an item that has no name
 *   - sql.js's context-free
 *     "Wrong API use : tried to bind a value of an unknown type (undefined)."
 *
 * Flip THROW_ON_BAD_DATA to false to keep the skip behaviour without the
 * throws — every caller already handles the "skip this one" path.
 */
export const THROW_ON_BAD_DATA: boolean = false;

/** Human-readable description of a value, for error messages. */
export function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number") {
    return Number.isNaN(value) ? "NaN" : `number ${value}`;
  }
  if (typeof value === "string") return `string ${JSON.stringify(value)}`;
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") {
    try {
      return `${value.constructor?.name ?? "object"} ${JSON.stringify(value)}`;
    } catch {
      return "object (not serialisable)";
    }
  }
  return `${typeof value} ${String(value)}`;
}

/**
 * Returns the item's name when it has a usable one, otherwise `null` so the
 * caller can skip it (`continue` in a loop, `false` in a filter).
 *
 * While THROW_ON_BAD_DATA is true it throws first, quoting `context`, so the
 * origin of the nameless item shows up in the message and the stack trace.
 */
export function requireItemName(
  item: { name?: unknown } | null | undefined,
  context: string,
): string | null {
  const name = item?.name;
  if (typeof name === "string" && name.trim() !== "") {
    return name;
  }
  if (THROW_ON_BAD_DATA) {
    throw new Error(
      `[${context}] item has no usable name: name is ${describeValue(name)}. ` +
        `Full item: ${describeValue(item)}`,
    );
  }
  return null;
}
