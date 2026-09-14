import { useEffect, useMemo, useState } from "react";
import { getReceipts, type Receipt } from "../db/operations";

export type ReceiptsViewMode = "compact" | "full";

export interface DailySpending {
  day: string;
  label: string;
  total: number;
}

export interface ReceiptsSummary {
  total: number;
  receiptsCount: number;
  days: number;
  perDay: number;
  perWeek: number;
  perMonth: number;
  perYear: number;
  rangeStart: string | null;
  rangeEnd: string | null;
}

const MS_PER_DAY = 86400000;
const DAYS_PER_WEEK = 7;
// Average calendar lengths, so the per month/per year figures do not drift
// with the length of the selected timeframe.
const DAYS_PER_MONTH = 365.25 / 12;
const DAYS_PER_YEAR = 365.25;

// "YYYY-MM-DD" (what <input type="date"> gives us) parsed in local time, so a
// filter boundary means the same day the receipts are listed under.
const parseDateInput = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const endOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() -
  1;

// Inclusive day count, computed from day starts so DST changes cannot shift it.
const daysBetween = (start: Date, end: Date): number =>
  Math.round((startOfDay(end) - startOfDay(start)) / MS_PER_DAY) + 1;

const dayKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

// "YYYY-MM-DD" -> "DD.MM.YYYY", matching how dates are shown elsewhere.
const dayLabel = (key: string): string =>
  `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;

const receiptTime = (receipt: Receipt): number =>
  new Date(receipt.timestamp).getTime();

export function useReceiptsLogic() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ReceiptsViewMode>("compact");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      setLoading(true);
      getReceipts()
        .then((result) => {
          if (!cancelled) setReceipts(result);
        })
        .catch((error) => {
          console.error("[useReceiptsLogic] failed to load receipts:", error);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    window.addEventListener("db-update", load);
    return () => {
      cancelled = true;
      window.removeEventListener("db-update", load);
    };
  }, []);

  const fromTime = useMemo(() => {
    const date = parseDateInput(fromDate);
    return date ? startOfDay(date) : null;
  }, [fromDate]);

  const toTime = useMemo(() => {
    const date = parseDateInput(toDate);
    return date ? endOfDay(date) : null;
  }, [toDate]);

  // No dates set means all time.
  const filteredReceipts = useMemo(() => {
    if (fromTime === null && toTime === null) return receipts;
    return receipts.filter((receipt) => {
      const time = receiptTime(receipt);
      if (isNaN(time)) return false;
      if (fromTime !== null && time < fromTime) return false;
      if (toTime !== null && time > toTime) return false;
      return true;
    });
  }, [receipts, fromTime, toTime]);

  const dailySpending = useMemo<DailySpending[]>(() => {
    const totals = new Map<string, number>();
    for (const receipt of filteredReceipts) {
      const date = new Date(receipt.timestamp);
      if (isNaN(date.getTime())) continue;
      const key = dayKey(date);
      totals.set(key, (totals.get(key) ?? 0) + receipt.total);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, total]) => ({ day, label: dayLabel(day), total }));
  }, [filteredReceipts]);

  const summary = useMemo<ReceiptsSummary>(() => {
    const total = filteredReceipts.reduce(
      (sum, receipt) => sum + receipt.total,
      0
    );

    // The timeframe is what was asked for; where it is open ended, the
    // receipts themselves define it.
    let earliest: number | null = null;
    let latest: number | null = null;
    for (const receipt of filteredReceipts) {
      const time = receiptTime(receipt);
      if (isNaN(time)) continue;
      if (earliest === null || time < earliest) earliest = time;
      if (latest === null || time > latest) latest = time;
    }

    const start =
      parseDateInput(fromDate) ??
      (earliest === null ? null : new Date(earliest));
    const end =
      parseDateInput(toDate) ?? (latest === null ? null : new Date(latest));

    const days = start && end ? Math.max(1, daysBetween(start, end)) : 0;
    const perDay = days > 0 ? total / days : 0;

    return {
      total,
      receiptsCount: filteredReceipts.length,
      days,
      perDay,
      perWeek: perDay * DAYS_PER_WEEK,
      perMonth: perDay * DAYS_PER_MONTH,
      perYear: perDay * DAYS_PER_YEAR,
      rangeStart: start ? start.toISOString() : null,
      rangeEnd: end ? end.toISOString() : null,
    };
  }, [filteredReceipts, fromDate, toDate]);

  const hasDateFilter = fromDate !== "" || toDate !== "";

  const clearDateFilter = () => {
    setFromDate("");
    setToDate("");
  };

  return {
    receipts: filteredReceipts,
    loading,
    viewMode,
    setViewMode,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    hasDateFilter,
    clearDateFilter,
    dailySpending,
    summary,
  };
}
