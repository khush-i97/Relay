import type { Restaurant } from "../../shared/contracts";

export function mapRestaurant(row: Record<string, unknown>): Restaurant {
  return {
    id: String(row.id),
    name: String(row.name),
    cuisine: String(row.cuisine),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    rarity: row.rarity as Restaurant["rarity"],
    discoveryXp: Number(row.discovery_xp),
    rewardCents: Number(row.reward_cents),
    estimatedMealCents: Number(row.estimated_meal_cents),
    tags: row.tags as string[],
    description: String(row.description),
    imageUrl: row.image_url ? String(row.image_url) : null,
    availability: row.availability as Restaurant["availability"],
    isSynthetic: Boolean(row.is_synthetic),
  };
}
