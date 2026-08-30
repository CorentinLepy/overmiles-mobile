import { useLocalSearchParams } from "expo-router";

import { QuickMomentScreen } from "@/src/features/timeline/screens/quick-moment-screen";

export default function QuickMomentRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  return <QuickMomentScreen tripId={tripId} />;
}
