import type { TripMapPoint } from "./map.types";

export type MapInitialViewState =
  | Readonly<{
      center: [number, number];
      zoom: number;
      padding?: never;
    }>
  | Readonly<{
      bounds: [number, number, number, number];
      padding: Readonly<{ top: number; right: number; bottom: number; left: number }>;
      center?: never;
      zoom?: never;
    }>;

const WORLD_VIEW: MapInitialViewState = Object.freeze({
  center: [0, 20],
  zoom: 1.35,
});

export function getMapInitialViewState(points: readonly TripMapPoint[]): MapInitialViewState {
  if (points.length === 0) return WORLD_VIEW;

  if (points.length === 1) {
    const point = points[0];
    return Object.freeze({
      center: [point.coordinate.longitude, point.coordinate.latitude],
      zoom: 10,
    });
  }

  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;

  for (const point of points) {
    west = Math.min(west, point.coordinate.longitude);
    south = Math.min(south, point.coordinate.latitude);
    east = Math.max(east, point.coordinate.longitude);
    north = Math.max(north, point.coordinate.latitude);
  }

  if (west === east && south === north) {
    return Object.freeze({
      center: [west, south],
      zoom: 10,
    });
  }

  return Object.freeze({
    bounds: [west, south, east, north],
    padding: Object.freeze({ top: 92, right: 44, bottom: 190, left: 44 }),
  });
}
