export type LocalJournalDraftState =
  | "draft_local"
  | "ready_to_sync"
  | "syncing"
  | "failed";

export type LocalJournalDraft = Readonly<{
  accountUserId: string;
  tripId: string;
  draftId: string;
  title: string;
  content: string;
  occurredAt: string;
  stopId: string | null;
  state: LocalJournalDraftState;
  createdAt: string;
  updatedAt: string;
}>;

export type SaveLocalJournalDraftInput = Readonly<{
  accountUserId: string;
  tripId: string;
  draftId: string;
  content: string;
  occurredAt: string;
  stopId?: string | null;
  state?: LocalJournalDraftState;
}>;

export function deriveJournalDraftTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length < 2) return "Note de voyage";
  return normalized.slice(0, 180);
}