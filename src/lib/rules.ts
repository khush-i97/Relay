export const VISIT_REWARD_CENTS = 50;
export const DAILY_CAP_CENTS = 200;
export const MIN_BILL_CENTS = 500;
export const MAX_REDEEM_CENTS = 500;
export const LOCATION_MAX_AGE_MS = 60_000;
export const LOCATION_MAX_ACCURACY_M = 100;
export const LOCATION_MAX_DISTANCE_M = 100;
export const XP_PER_LEVEL = 1000;
export const NEARBY_RADIUS_M = 10_000;

export const SF_CENTER = { latitude: 37.791, longitude: -122.4055 };

export const INITIAL_CAMERA = {
  latitude: SF_CENTER.latitude,
  longitude: SF_CENTER.longitude,
  zoom: 15.15,
  pitch: 50,
  bearing: -16,
};

export const RARITY_XP = {
  common: 150,
  rare: 400,
  epic: 800,
  legendary: 1200,
} as const;

export const REDEEM_SUCCESS_MESSAGE =
  "Demo complete. Your reward balance was applied in the simulation. This is not a payment to the restaurant.";
