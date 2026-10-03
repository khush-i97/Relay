export const MAP_LABELS = [
  { name: "Chinatown", latitude: 37.7944, longitude: -122.4072 },
  { name: "North Beach", latitude: 37.8012, longitude: -122.4104 },
  { name: "FiDi", latitude: 37.7932, longitude: -122.3996 },
  { name: "Union Square", latitude: 37.7876, longitude: -122.4074 },
  { name: "SoMa", latitude: 37.7802, longitude: -122.4022 },
  { name: "The Bay", latitude: 37.7925, longitude: -122.3895 },
];

type Feature = {
  type: "Feature";
  properties: { kind: string };
  geometry:
    | { type: "Polygon"; coordinates: [number, number][][] }
    | { type: "LineString"; coordinates: [number, number][] };
};

function line(kind: string, coordinates: [number, number][]): Feature {
  return { type: "Feature", properties: { kind }, geometry: { type: "LineString", coordinates } };
}

function polygon(kind: string, ring: [number, number][]): Feature {
  return { type: "Feature", properties: { kind }, geometry: { type: "Polygon", coordinates: [ring] } };
}

function square(kind: string, latitude: number, longitude: number, size: number): Feature {
  const dLat = size;
  const dLng = size * 1.25;
  return polygon(kind, [
    [longitude - dLng, latitude - dLat],
    [longitude + dLng, latitude - dLat],
    [longitude + dLng, latitude + dLat],
    [longitude - dLng, latitude + dLat],
    [longitude - dLng, latitude - dLat],
  ]);
}

export function demoStyle() {
  const features: Feature[] = [];
  const shore: [number, number][] = [
    [-122.412, 37.809],
    [-122.405, 37.806],
    [-122.399, 37.801],
    [-122.3952, 37.796],
    [-122.3932, 37.79],
    [-122.3945, 37.782],
    [-122.399, 37.774],
  ];
  features.push(
    polygon("water", [
      ...shore,
      [-122.378, 37.774],
      [-122.378, 37.809],
      shore[0] ?? [-122.412, 37.809],
    ]),
  );
  features.push(line("major", shore));
  features.push(
    square("park", 37.8008, -122.4102, 0.0013),
    square("park", 37.7947, -122.4052, 0.0009),
    square("park", 37.7949, -122.3982, 0.0011),
    square("park", 37.7862, -122.4046, 0.001),
  );

  for (let latitude = 37.776; latitude <= 37.806; latitude += 0.0018) {
    const kind = Math.round((latitude - 37.776) / 0.0018) % 4 === 0 ? "major" : "road";
    features.push(
      line(kind, [
        [-122.42, Number(latitude.toFixed(5))],
        [-122.393, Number(latitude.toFixed(5))],
      ]),
    );
  }
  for (let longitude = -122.42; longitude <= -122.394; longitude += 0.00215) {
    const kind = Math.round((longitude + 122.42) / 0.00215) % 4 === 0 ? "major" : "road";
    features.push(
      line(kind, [
        [Number(longitude.toFixed(5)), 37.774],
        [Number(longitude.toFixed(5)), 37.808],
      ]),
    );
  }
  features.push(
    line("major", [
      [-122.4195, 37.775],
      [-122.41, 37.784],
      [-122.4, 37.792],
      [-122.3935, 37.7955],
    ]),
  );
  features.push(
    line("major", [
      [-122.4065, 37.7955],
      [-122.412, 37.802],
      [-122.4155, 37.8065],
    ]),
  );

  return {
    version: 8 as const,
    sources: {
      demo: {
        type: "geojson" as const,
        data: { type: "FeatureCollection" as const, features },
      },
    },
    layers: [
      { id: "bg", type: "background" as const, paint: { "background-color": "#efe6d8" } },
      {
        id: "water",
        type: "fill" as const,
        source: "demo",
        filter: ["==", ["get", "kind"], "water"],
        paint: { "fill-color": "#b7cdc7" },
      },
      {
        id: "park",
        type: "fill" as const,
        source: "demo",
        filter: ["==", ["get", "kind"], "park"],
        paint: { "fill-color": "#d3e2c8" },
      },
      {
        id: "road",
        type: "line" as const,
        source: "demo",
        filter: ["==", ["get", "kind"], "road"],
        paint: {
          "line-color": "#f7f3ec",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 14, 1.8, 16, 4],
        },
      },
      {
        id: "major",
        type: "line" as const,
        source: "demo",
        filter: ["==", ["get", "kind"], "major"],
        paint: {
          "line-color": "#fffdf8",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 14, 3.2, 16, 7],
        },
      },
    ],
  };
}

export const DEMO_STYLE = demoStyle();
