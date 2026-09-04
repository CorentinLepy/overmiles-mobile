import { useLocalSearchParams } from "expo-router";

import { PhotoCaptureScreen } from "@/src/features/media/screens/photo-capture-screen";

export default function PhotoCaptureRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  return <PhotoCaptureScreen tripId={tripId} />;
}
