import { useLocalSearchParams } from "expo-router";

import { parseMapMomentContext } from "@/src/features/timeline/map-moment-context";
import { QuickMomentScreen } from "@/src/features/timeline/screens/quick-moment-screen";

export default function QuickMomentRoute() {
  const params = useLocalSearchParams<{
    tripId: string;
    source?: string;
    pointLabel?: string;
    latitude?: string;
    longitude?: string;
  }>();
  const mapContext = parseMapMomentContext(params);

  return <QuickMomentScreen tripId={params.tripId} mapContext={mapContext} />;
}
