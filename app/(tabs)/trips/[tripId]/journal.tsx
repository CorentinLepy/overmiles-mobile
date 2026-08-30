import { useLocalSearchParams } from "expo-router";

import { QuickJournalScreen } from "@/src/features/journal/screens/quick-journal-screen";

export default function QuickJournalRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  return <QuickJournalScreen tripId={tripId} />;
}
