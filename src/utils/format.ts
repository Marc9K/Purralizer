export const formatNumber = (num: number): string => {
  const rounded = Math.round(num * 100) / 100;
  // Convert to string with 2 decimals, then remove trailing zeros
  return rounded.toFixed(2).replace(/\.?0+$/, "");
};

export const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};
