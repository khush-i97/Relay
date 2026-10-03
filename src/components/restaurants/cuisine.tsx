import {
  Beef,
  Coffee,
  Croissant,
  Egg,
  Fish,
  Flame,
  Leaf,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Sun,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Chinese: Soup,
  Japanese: Fish,
  Indian: Flame,
  Mediterranean: Sun,
  Italian: Wheat,
  Pizza: Pizza,
  Seafood: Fish,
  Mexican: Sandwich,
  Korean: Flame,
  Levantine: Leaf,
  Caribbean: Sun,
  American: Beef,
  Bakery: Croissant,
  Vietnamese: Soup,
  Steakhouse: Beef,
  Vegetarian: Salad,
  "Tea House": Coffee,
  Californian: Salad,
  Barbecue: Flame,
  Sandwiches: Sandwich,
  Brunch: Egg,
  Salvadoran: Wheat,
};

export function cuisineIcon(cuisine: string): LucideIcon {
  return ICONS[cuisine] ?? UtensilsCrossed;
}

export function CuisineIcon({ cuisine, className }: { cuisine: string; className?: string }) {
  const Icon = cuisineIcon(cuisine);
  return <Icon className={className} aria-hidden />;
}
