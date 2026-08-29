import type { TripSummary } from "./trips.types";

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatTripDateRange(trip: TripSummary): string {
  if (!trip.startsAt && !trip.endsAt) return "Dates à définir";

  const start = parseDate(trip.startsAt);
  const end = parseDate(trip.endsAt);

  if (start && end) {
    return `${shortDateFormatter.format(start)} → ${shortDateFormatter.format(end)}`;
  }
  if (start) return `À partir du ${shortDateFormatter.format(start)}`;
  if (end) return `Jusqu’au ${shortDateFormatter.format(end)}`;
  return "Dates à définir";
}

export function formatCountries(trip: TripSummary): string {
  if (trip.countries.length === 0) return "Destination à préciser";
  return trip.countries.join(" · ");
}

export function tripTemporalLabel(trip: TripSummary): string {
  if (trip.status === "ARCHIVED") return "Archivé";
  if (trip.status === "DRAFT" && !trip.startsAt) return "Brouillon";

  const now = Date.now();
  const start = trip.startsAt ? Date.parse(trip.startsAt) : Number.NaN;
  const end = trip.endsAt ? Date.parse(trip.endsAt) : start;

  if (!Number.isNaN(start) && start > now) return "À venir";
  if (!Number.isNaN(start) && !Number.isNaN(end) && start <= now && end >= now) {
    return "En voyage";
  }
  if (!Number.isNaN(end) && end < now) return "Terminé";
  return trip.status === "ACTIVE" ? "Actif" : "Brouillon";
}

export function daysUntilTrip(trip: TripSummary): number | null {
  if (!trip.startsAt) return null;
  const start = Date.parse(trip.startsAt);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.ceil((start - Date.now()) / 86_400_000));
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
