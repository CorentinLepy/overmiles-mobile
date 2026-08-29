export type TripStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type TripParticipantSummary = Readonly<{
  id: string;
  userId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  user?: Readonly<{
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  }>;
}>;

export type TripCounters = Readonly<{
  participants: number;
  events: number;
  locations: number;
  stops: number;
  photos: number;
  journalEntries: number;
  expenses: number;
  documents: number;
}>;

export type TripSummary = Readonly<{
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  status: TripStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  countries: string[];
  coverImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  version?: number;
  participants?: TripParticipantSummary[];
  _count?: TripCounters;
}>;
