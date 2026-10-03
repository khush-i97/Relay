/** Filter chips for the cuisines actually present, keeping the active choice so it can be cleared. */
export function cuisineOptions(restaurants: { cuisine: string }[], active: string | null): string[] {
  const names = new Set(restaurants.map((restaurant) => restaurant.cuisine));
  if (active) names.add(active);
  return [...names].sort((a, b) => a.localeCompare(b));
}
