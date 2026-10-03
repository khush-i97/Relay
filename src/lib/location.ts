import type { LocationFix } from "@/lib/contracts";

export function captureBrowserLocation(): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser doesn't share location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
          capturedAt: new Date().toISOString(),
          simulated: false,
        });
      },
      () => {
        reject(new Error("Location permission was denied. You can keep browsing the SF demo."));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}
