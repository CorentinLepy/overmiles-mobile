export type TripParticipantSummary = Readonly<{
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
}>;

export type TripCounts = Readonly<{
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
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  countries: string[];
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  version?: number;
  updatedByUserId?: string | null;
  participants?: TripParticipantSummary[];
  _count?: TripCounts;
}>;

export type TripUpdatePatch = Readonly<
  Partial<
    Pick<
      TripSummary,
      | "name"
      | "description"
      | "status"
      | "startsAt"
      | "endsAt"
      | "countries"
      | "coverImageUrl",
    >
  >
>;
