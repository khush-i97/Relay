import type { Restaurant } from "@/lib/contracts";
import { RARITY_XP, VISIT_REWARD_CENTS } from "@/lib/rules";

function venue(
  partial: Omit<Restaurant, "rewardCents" | "imageUrl" | "synthetic" | "availability" | "firstDiscoveryXp"> & {
    rarity: Restaurant["rarity"];
  },
): Restaurant {
  return {
    ...partial,
    firstDiscoveryXp: RARITY_XP[partial.rarity],
    rewardCents: VISIT_REWARD_CENTS,
    imageUrl: null,
    synthetic: true,
    availability: null,
  };
}

export const FIXTURES: Restaurant[] = [
  venue({
    id: "rst_lantern",
    name: "Lantern Dumpling House",
    cuisine: "Chinese",
    rarity: "legendary",
    estimatedMealCents: 1800,
    coordinates: { latitude: 37.7948, longitude: -122.4068 },
  }),
  venue({
    id: "rst_crane",
    name: "Paper Crane Bao",
    cuisine: "Chinese",
    rarity: "rare",
    estimatedMealCents: 1400,
    coordinates: { latitude: 37.7962, longitude: -122.4094 },
  }),
  venue({
    id: "rst_fog",
    name: "Fogcutter Ramen",
    cuisine: "Japanese",
    rarity: "epic",
    estimatedMealCents: 2200,
    coordinates: { latitude: 37.7914, longitude: -122.4122 },
  }),
  venue({
    id: "rst_miso",
    name: "Miso Morning",
    cuisine: "Japanese",
    rarity: "common",
    estimatedMealCents: 1600,
    coordinates: { latitude: 37.7884, longitude: -122.4002 },
  }),
  venue({
    id: "rst_saffron",
    name: "Saffron Window",
    cuisine: "Indian",
    rarity: "rare",
    estimatedMealCents: 1900,
    coordinates: { latitude: 37.7848, longitude: -122.4116 },
  }),
  venue({
    id: "rst_olive",
    name: "The Olive Cart",
    cuisine: "Mediterranean",
    rarity: "common",
    estimatedMealCents: 2100,
    coordinates: { latitude: 37.7926, longitude: -122.3994 },
  }),
  venue({
    id: "rst_basil",
    name: "Brick & Basil",
    cuisine: "Italian",
    rarity: "rare",
    estimatedMealCents: 2400,
    coordinates: { latitude: 37.8006, longitude: -122.4092 },
  }),
  venue({
    id: "rst_coal",
    name: "Coal Oven North",
    cuisine: "Pizza",
    rarity: "common",
    estimatedMealCents: 1700,
    coordinates: { latitude: 37.7992, longitude: -122.4064 },
  }),
  venue({
    id: "rst_tide",
    name: "Tidepool",
    cuisine: "Seafood",
    rarity: "epic",
    estimatedMealCents: 3200,
    coordinates: { latitude: 37.796, longitude: -122.3956 },
  }),
  venue({
    id: "rst_gold",
    name: "Golden Hour Tacos",
    cuisine: "Mexican",
    rarity: "common",
    estimatedMealCents: 1300,
    coordinates: { latitude: 37.7816, longitude: -122.4048 },
  }),
  venue({
    id: "rst_clay",
    name: "Red Clay Pot",
    cuisine: "Korean",
    rarity: "legendary",
    estimatedMealCents: 2600,
    coordinates: { latitude: 37.7858, longitude: -122.4098 },
  }),
  venue({
    id: "rst_cedar",
    name: "Cedar & Pomegranate",
    cuisine: "Levantine",
    rarity: "epic",
    estimatedMealCents: 2300,
    coordinates: { latitude: 37.7874, longitude: -122.4158 },
  }),
  venue({
    id: "rst_plantain",
    name: "Plantain Social",
    cuisine: "Caribbean",
    rarity: "rare",
    estimatedMealCents: 1800,
    coordinates: { latitude: 37.7804, longitude: -122.4092 },
  }),
  venue({
    id: "rst_rye",
    name: "Little Rye",
    cuisine: "American",
    rarity: "common",
    estimatedMealCents: 1500,
    coordinates: { latitude: 37.7904, longitude: -122.4036 },
  }),
  venue({
    id: "rst_honey",
    name: "Honeybutter Buns",
    cuisine: "Bakery",
    rarity: "rare",
    estimatedMealCents: 1200,
    coordinates: { latitude: 37.7866, longitude: -122.4014 },
  }),
  venue({
    id: "rst_violet",
    name: "Violet Pho",
    cuisine: "Vietnamese",
    rarity: "common",
    estimatedMealCents: 1400,
    coordinates: { latitude: 37.7832, longitude: -122.4072 },
  }),
  venue({
    id: "rst_cinder",
    name: "Salt & Cinder",
    cuisine: "Steakhouse",
    rarity: "legendary",
    estimatedMealCents: 3800,
    coordinates: { latitude: 37.7922, longitude: -122.4018 },
  }),
  venue({
    id: "rst_jar",
    name: "Green Jar",
    cuisine: "Vegetarian",
    rarity: "epic",
    estimatedMealCents: 2000,
    coordinates: { latitude: 37.789, longitude: -122.4146 },
  }),
];

export const CUISINES = [
  "Chinese",
  "Japanese",
  "Indian",
  "Mediterranean",
  "Italian",
  "Pizza",
  "Seafood",
  "Mexican",
  "Korean",
  "Levantine",
  "Caribbean",
  "American",
  "Bakery",
  "Vietnamese",
  "Steakhouse",
  "Vegetarian",
] as const;

const byId = new Map(FIXTURES.map((restaurant) => [restaurant.id, restaurant]));

export function restaurantById(id: string) {
  return byId.get(id) ?? null;
}
