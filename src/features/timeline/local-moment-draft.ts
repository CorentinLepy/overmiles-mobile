export const TIMELINE_EVENT_TYPES = [
  "MANUAL",
  "LOCATION",
  "PHOTO",
  "NOTE",
  "EXPENSE",
  "DOCUMENT",
  "TRANSPORT",
  "ACTIVITY",
] as const;

export type LocalTimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
export type LocalMomentDraftState = "draft_local" | "ready_to_sync" | "syncing" | "failed";

export type LocalMomentDraft = Readonly<{
  accountUserId: string;
  tripId: string;
  draftId: string;
  type: LocalTimelineEventType;
  title: string;
  description: string | null;
  occurredAt: string;
  endsAt: string | null;
  allDay: boolean;
  stopId: string | null;
  latitude: number | null;
  longitude: number | null;
  state: LocalMomentDraftState;
  createdAt: string;
  updatedAt: string;
}>;

export type SaveLocalMomentDraftInput = Readonly<{
  accountUserId: string;
  tripId: string;
  draftId: string;
  type?: LocalTimelineEventType;
  title: string;
  description?: string | null;
  occurredAt: string;
  endsAt?: string | null;
  allDay?: boolean;
  stopId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  state?: LocalMomentDraftState;
}>;

export function assertLocalMomentDraftInput(input: SaveLocalMomentDraftInput): void {
  const type = input.type ?? "MANUAL";
  if (!TIMELINE_EVENT_TYPES.includes(type)) {
    throw new Error("Type de moment local invalide.");
  }
  if (input.title.length > 180) {
    throw new Error("Le titre du moment local est trop long.");
  }
  if ((input.description?.length ?? 0) > 5000) {
    throw new Error("La description du moment local est trop longue.");
  }
  if (!isIsoDate(input.occurredAt)) {
    throw new Error("Date du moment local invalide.");
  }
  if (input.endsAt && !isIsoDate(input.endsAt)) {
    throw new Error("Date de fin du moment local invalide.");
  }
  if (input.endsAt && Date.parse(input.endsAt) < Date.parse(input.occurredAt)) {
    throw new Error("La fin du moment local précède son début.");
  }
  validateCoordinates(input.latitude, input.longitude);

  if ((input.state ?? "draft_local") === "ready_to_sync" && input.title.trim().length < 2) {
    throw new Error("Un moment prêt à synchroniser doit avoir un titre.");
  }
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validateCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): void {
  if (latitude === undefined || latitude === null) {
    if (longitude !== undefined && longitude !== null) {
      throw new Error("Les coordonnées du moment doivent être fournies ensemble.");
    }
    return;
  }
  if (longitude === undefined || longitude === null) {
    throw new Error("Les coordonnées du moment doivent être fournies ensemble.");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Coordonnées du moment local invalides.");
  }
}
