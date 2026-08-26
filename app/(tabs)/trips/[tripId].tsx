import { useLocalSearchParams } from "expo-router";

import { TripDetailScreen } from "@/src/features/trips/screens/trip-detail-screen";

export default function TripDetailRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  return <TripDetailScreen tripId={tripId} />;
}
