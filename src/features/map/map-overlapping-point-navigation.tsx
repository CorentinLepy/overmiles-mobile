import { Pressable, Text, View } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import type { TripMapPoint } from "./map.types";

export function MapOverlappingPointNavigation({
  point,
  points,
  onSelectPoint,
}: {
  point: TripMapPoint;
  points: readonly TripMapPoint[];
  onSelectPoint: (pointId: string) => void;
}) {
  const theme = useOverMilesTheme();
  const siblings = findExactOverlappingPoints(point, points);
  const currentIndex = siblings.findIndex((candidate) => candidate.id === point.id);

  if (siblings.length < 2 || currentIndex < 0) return null;

  const previous = siblings[(currentIndex - 1 + siblings.length) % siblings.length];
  const next = siblings[(currentIndex + 1) % siblings.length];

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Repère ${currentIndex + 1} sur ${siblings.length} à cet emplacement`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
      }}
    >
      <SiblingButton
        label="Précédent"
        accessibilityLabel={`Afficher le repère précédent, ${previous.label}`}
        onPress={() => onSelectPoint(previous.id)}
      />
      <Text
        selectable
        style={{
          flex: 1,
          textAlign: "center",
          color: theme.color.muted,
          fontSize: 12,
          fontWeight: "800",
        }}
      >
        {currentIndex + 1} / {siblings.length}
      </Text>
      <SiblingButton
        label="Suivant"
        accessibilityLabel={`Afficher le repère suivant, ${next.label}`}
        onPress={() => onSelectPoint(next.id)}
      />
    </View>
  );
}

export function findExactOverlappingPoints(
  point: TripMapPoint,
  points: readonly TripMapPoint[],
): readonly TripMapPoint[] {
  return points
    .filter(
      (candidate) =>
        candidate.coordinate.latitude === point.coordinate.latitude &&
        candidate.coordinate.longitude === point.coordinate.longitude,
    )
    .toSorted(compareMapPoints);
}

function compareMapPoints(left: TripMapPoint, right: TripMapPoint): number {
  const leftTime = left.occurredAt ? Date.parse(left.occurredAt) : Number.POSITIVE_INFINITY;
  const rightTime = right.occurredAt ? Date.parse(right.occurredAt) : Number.POSITIVE_INFINITY;
  const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.POSITIVE_INFINITY;
  const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.POSITIVE_INFINITY;

  if (safeLeftTime !== safeRightTime) return safeLeftTime - safeRightTime;
  return left.id.localeCompare(right.id);
}

function SiblingButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useOverMilesTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 88,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.control,
        borderCurve: "continuous",
        backgroundColor: theme.color.surfaceMuted,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text selectable style={{ color: theme.color.ink, fontSize: 13, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}
