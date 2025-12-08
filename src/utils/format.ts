export const formatNumber = (num: number): string => {
  const rounded = Math.round(num * 100) / 100;
  // Convert to string with 2 decimals, then remove trailing zeros
  return rounded.toFixed(2).replace(/\.?0+$/, "");
};

export const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

export const formatShortDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);
  return `${month} '${year}`;
};
