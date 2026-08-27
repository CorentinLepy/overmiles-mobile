import { View } from "react-native";

import { SectionCard } from "@/src/components/ui/section-card";
import { SkeletonBlock } from "@/src/components/ui/skeleton-block";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function HomeTripLoadingSkeleton() {
  const theme = useOverMilesTheme();

  return (
    <SectionCard>
      <SkeletonBlock height={172} radius={theme.radius.card} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md }}>
        <SkeletonBlock height={30} width={132} radius={theme.radius.pill} />
        <SkeletonBlock height={20} width={48} radius={theme.radius.pill} />
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <SkeletonBlock height={32} width="72%" />
        <SkeletonBlock height={18} width="48%" />
        <SkeletonBlock height={18} width="58%" />
      </View>
      <SkeletonBlock height={50} radius={theme.radius.pill} />
    </SectionCard>
  );
}

export function TripsListLoadingSkeleton({ count = 3 }: { count?: number }) {
  const theme = useOverMilesTheme();

  return (
    <View accessibilityLabel="Chargement de vos voyages" accessibilityRole="progressbar" style={{ gap: theme.spacing.md }}>
      {Array.from({ length: count }, (_, index) => (
        <SectionCard key={`trip-skeleton-${index}`}>
          <SkeletonBlock height={150} radius={theme.radius.card} />
          <View style={{ gap: theme.spacing.sm }}>
            <SkeletonBlock height={25} width={index % 2 === 0 ? "68%" : "78%"} />
            <SkeletonBlock height={17} width="46%" />
            <SkeletonBlock height={17} width="62%" />
          </View>
        </SectionCard>
      ))}
    </View>
  );
}
