import ItemCard from "./ItemCard";
import type { ItemWithStats } from "../db/operations";

type ItemsListItemProps = {
  item: ItemWithStats;
};

export default function ItemsListItem({ item }: ItemsListItemProps) {
  return <ItemCard item={item} />;
}
