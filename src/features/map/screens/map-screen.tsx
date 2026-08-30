import {
  Camera,
  GeoJSONSource,
  Layer,
  LocationManager,
  Map,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { readPublicRuntimeConfig } from "@/src/config/env";
import { findCurrentTrip } from "@/src/features/trips/trip-formatters";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import {
  openResolvedExternalNavigationTarget,
  resolveExternalNavigationTargets,
} from "../external-navigation";
import { MapCurrentTripFocus } from "../map-current-trip-focus";
import { createVisitedPointsFeatureCollection } from "../map-geojson";
import { MapTerrainActions } from "../map-terrain-actions";
import { getMapInitialViewState } from "../map-viewport";
import type { MapDataState, TripMapPoint } from "../map.types";
import { useMapData } from "../use-map-data";

const NATIVE_TAB_BAR_CLEARANCE = 72;

export function MapScreen() {
  const theme = useOverMilesTheme();
  const insets = useSafeAreaInsets();
  const runtimeConfig = useMemo(() => readPublicRuntimeConfig(), []);
  const { trips } = useTripsData();
  const { state, isRefreshing, refresh } = useMapData();
  const points = pointsFromState(state);
  const currentTrip = findCurrentTrip(trips);
  const [isCurrentTripFocused, setIsCurrentTripFocused] = useState(false);
  const focusedTripId = currentTrip && isCurrentTripFocused ? currentTrip.id : null;
  const visiblePoints = focusedTripId
    ? points.filter((point) => point.tripId === focusedTripId)
    : points;
  const featureCollection = createVisitedPointsFeatureCollection(visiblePoints);
  const initialViewState = getMapInitialViewState(visiblePoints);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [mapStyleFailed, setMapStyleFailed] = useState(false);
  const [isUserLocationEnabled, setIsUserLocationEnabled] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const selectedPoint = visiblePoints.find((point) => point.id === selectedPointId) ?? null;
  const cameraKey = `${focusedTripId ?? "all"}:${visiblePoints.length}:${visiblePoints[0]?.id ?? "empty"}:${visiblePoints.at(-1)?.id ?? "empty"}`;

  async function toggleUserLocation(): Promise<void> {
    if (isUserLocationEnabled) {
      setIsUserLocationEnabled(false);
      return;
    }

    setIsRequestingLocation(true);
    try {
      const granted = await LocationManager.requestPermissions();
      if (!granted) {
        Alert.alert(
          "Localisation désactivée",
          "Autorisez la localisation pendant l’utilisation pour afficher votre position sur la carte.",
        );
        return;
      }

      setIsUserLocationEnabled(true);
    } catch {
      Alert.alert(
        "Localisation indisponible",
        "OverMiles n’a pas pu accéder à votre position pour le moment.",
      );
    } finally {
      setIsRequestingLocation(false);
    }
  }

  function toggleCurrentTripFocus(): void {
    setSelectedPointId(null);
    setIsCurrentTripFocused((current) => !current);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.canvas }}>
      <Map
        mapStyle={runtimeConfig.mapStyleUrl}
        style={{ flex: 1 }}
        attribution
        logo
        compass
        onDidFinishLoadingMap={() => setMapStyleFailed(false)}
        onDidFailLoadingMap={() => setMapStyleFailed(true)}
      >
        <Camera
          key={cameraKey}
          initialViewState={initialViewState}
          {...(isUserLocationEnabled ? { trackUserLocation: "default" as const, zoom: 15 } : {})}
        />
        <GeoJSONSource
          id="overmiles-visited-points"
          data={featureCollection}
          onPress={(event) => {
            const id = event.nativeEvent.features?.[0]?.properties?.id;
            if (typeof id === "string") setSelectedPointId(id);
          }}
        >
          <Layer
            id="overmiles-visited-points-layer"
            type="circle"
            source="overmiles-visited-points"
            paint={{
              "circle-color": theme.color.success,
              "circle-radius": 7,
              "circle-stroke-color": theme.color.surface,
              "circle-stroke-width": 2.5,
              "circle-opacity": 0.95,
            }}
          />
          <Layer
            id="overmiles-selected-point-layer"
            type="circle"
            source="overmiles-visited-points"
            filter={["==", ["get", "id"], selectedPointId ?? ""]}
            paint={{
              "circle-color": theme.color.accent,
              "circle-radius": 11,
              "circle-stroke-color": theme.color.surface,
              "circle-stroke-width": 3,
            }}
          />
        </GeoJSONSource>
        {isUserLocationEnabled ? <UserLocation animated accuracy minDisplacement={5} /> : null}
      </Map>

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: theme.spacing.md,
          left: theme.spacing.md,
          right: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radius.card,
            borderCurve: "continuous",
            backgroundColor: theme.color.surface,
            borderWidth: 1,
            borderColor: theme.color.border,
            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.10)",
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: theme.color.ink, fontSize: 17, fontWeight: "800" }}>
              Votre carte OverMiles
            </Text>
            <Text selectable style={{ color: theme.color.muted, fontSize: 13, lineHeight: 18 }}>
              {statusLabel(state, visiblePoints.length, focusedTripId ? currentTrip?.name : null)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualiser la carte"
            disabled={isRefreshing}
            onPress={() => void refresh()}
            style={({ pressed }) => ({
              minWidth: 46,
              minHeight: 46,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 12,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.surfaceMuted,
              opacity: isRefreshing ? 0.55 : pressed ? 0.75 : 1,
            })}
          >
            <Text style={{ color: theme.color.ink, fontSize: 13, fontWeight: "800" }}>
              {isRefreshing ? "…" : "↻"}
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
          }}
        >
          {currentTrip ? (
            <MapCurrentTripFocus
              trip={currentTrip}
              isFocused={focusedTripId !== null}
              onToggle={toggleCurrentTripFocus}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isUserLocationEnabled ? "Masquer ma position" : "Afficher ma position sur la carte"
            }
            accessibilityState={{
              busy: isRequestingLocation,
              selected: isUserLocationEnabled,
            }}
            disabled={isRequestingLocation}
            onPress={() => void toggleUserLocation()}
            style={({ pressed }) => ({
              minHeight: 44,
              marginLeft: "auto",
              flexShrink: 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.surface,
              borderWidth: 1,
              borderColor: isUserLocationEnabled ? theme.color.accent : theme.color.border,
              boxShadow: "0 3px 12px rgba(0, 0, 0, 0.10)",
              opacity: isRequestingLocation ? 0.55 : pressed ? 0.72 : 1,
            })}
          >
            <Text selectable style={{ color: theme.color.ink, fontSize: 13, fontWeight: "800" }}>
              {isRequestingLocation
                ? "Localisation…"
                : isUserLocationEnabled
                  ? "Position affichée"
                  : "Ma position"}
            </Text>
          </Pressable>
        </View>

        {state.status === "offline" ? (
          <StatusPill label="Hors-ligne · données disponibles conservées" tone="warning" />
        ) : state.status === "error" ? (
          <StatusPill label={state.message} tone="warning" />
        ) : mapStyleFailed ? (
          <StatusPill label="Le fond de carte n’a pas pu être chargé." tone="warning" />
        ) : null}
      </View>

      {state.status === "loading" || state.status === "idle" ? (
        <CenterCard
          title="Préparation de votre carte…"
          description="OverMiles rassemble vos étapes et moments géolocalisés."
        />
      ) : visiblePoints.length === 0 ? (
        <CenterCard
          title={
            focusedTripId
              ? "Aucun repère pour ce voyage."
              : "Aucun repère géolocalisé pour le moment."
          }
          description={
            focusedTripId
              ? "Passez sur Tous les voyages pour retrouver vos autres repères."
              : "Les étapes et moments avec coordonnées apparaîtront ici automatiquement."
          }
        />
      ) : null}

      {selectedPoint ? (
        <SelectedPointCard
          point={selectedPoint}
          isOffline={state.status === "offline"}
          onClose={() => setSelectedPointId(null)}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

function pointsFromState(state: MapDataState): readonly TripMapPoint[] {
  return state.status === "ready" || state.status === "offline" || state.status === "error"
    ? state.points
    : [];
}

function statusLabel(state: MapDataState, count: number, focusedTripName?: string | null): string {
  if (state.status === "loading" || state.status === "idle") return "Chargement des repères…";
  if (focusedTripName && count === 0) return `Aucun repère · ${focusedTripName}`;
  if (focusedTripName) {
    return `${count} repère${count > 1 ? "s" : ""} · ${focusedTripName}`;
  }
  if (count === 0) return "Aucun repère visité géolocalisé";
  return `${count} repère${count > 1 ? "s" : ""} visité${count > 1 ? "s" : ""}`;
}

function StatusPill({ label, tone }: { label: string; tone: "warning" }) {
  const theme = useOverMilesTheme();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.color.surface,
        borderWidth: 1,
        borderColor: theme.color.border,
      }}
    >
      <Text
        selectable
        style={{
          color: tone === "warning" ? theme.color.warning : theme.color.ink,
          fontSize: 12,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function CenterCard({ title, description }: { title: string; description: string }) {
  const theme = useOverMilesTheme();

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        top: "42%",
        gap: theme.spacing.xs,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.card,
        borderCurve: "continuous",
        backgroundColor: theme.color.surface,
        borderWidth: 1,
        borderColor: theme.color.border,
        boxShadow: "0 6px 24px rgba(0, 0, 0, 0.12)",
      }}
    >
      <Text selectable style={{ color: theme.color.ink, fontSize: 20, fontWeight: "800" }}>
        {title}
      </Text>
      <Text selectable style={{ color: theme.color.muted, fontSize: 14, lineHeight: 20 }}>
        {description}
      </Text>
    </View>
  );
}

function SelectedPointCard({
  point,
  isOffline,
  onClose,
  bottomInset,
}: {
  point: TripMapPoint;
  isOffline: boolean;
  onClose: () => void;
  bottomInset: number;
}) {
  const router = useRouter();
  const theme = useOverMilesTheme();

  async function showNavigationChoices(): Promise<void> {
    try {
      const targets = await resolveExternalNavigationTargets({
        coordinate: point.coordinate,
        destinationLabel: point.label,
      });

      Alert.alert(
        "Naviguer",
        point.label,
        [
          ...targets.map((target) => ({
            text: target.label,
            onPress: () => {
              void openResolvedExternalNavigationTarget(target).catch(() => {
                Alert.alert(
                  "Navigation indisponible",
                  "Impossible d’ouvrir cette destination pour le moment.",
                );
              });
            },
          })),
          { text: "Annuler", style: "cancel" as const },
        ],
        { cancelable: true },
      );
    } catch {
      Alert.alert(
        "Navigation indisponible",
        "Les coordonnées de ce repère ne permettent pas de lancer un itinéraire.",
      );
    }
  }

  return (
    <View
      style={{
        position: "absolute",
        left: theme.spacing.md,
        right: theme.spacing.md,
        bottom: bottomInset + NATIVE_TAB_BAR_CLEARANCE,
        gap: theme.spacing.sm,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.card,
        borderCurve: "continuous",
        backgroundColor: theme.color.surface,
        borderWidth: 1,
        borderColor: theme.color.border,
        boxShadow: "0 8px 28px rgba(0, 0, 0, 0.16)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={{ color: theme.color.accent, fontSize: 12, fontWeight: "800" }}>
            {kindLabel(point.kind).toUpperCase()}
          </Text>
          <Text
            selectable
            style={{ color: theme.color.ink, fontSize: 21, lineHeight: 25, fontWeight: "800" }}
          >
            {point.label}
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 14 }}>
            {point.tripName}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer le détail du repère"
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={{ color: theme.color.muted, fontSize: 22, fontWeight: "600" }}>×</Text>
        </Pressable>
      </View>
      {isOffline ? (
        <View
          accessibilityRole="text"
          accessibilityLabel="Disponible hors ligne"
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 6,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.color.surfaceMuted,
          }}
        >
          <Text selectable style={{ color: theme.color.muted, fontSize: 12, fontWeight: "800" }}>
            Disponible hors ligne
          </Text>
        </View>
      ) : null}
      {point.occurredAt ? (
        <Text selectable style={{ color: theme.color.ink, fontSize: 13 }}>
          {formatPointDate(point.occurredAt)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voir le voyage ${point.tripName}`}
        onPress={() => router.push(`/trips/${point.tripId}`)}
        style={({ pressed }) => ({
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.control,
          borderCurve: "continuous",
          backgroundColor: theme.color.surfaceMuted,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Text selectable style={{ color: theme.color.ink, fontSize: 14, fontWeight: "800" }}>
          Voir le voyage
        </Text>
        <Text style={{ color: theme.color.muted, fontSize: 18, fontWeight: "700" }}>›</Text>
      </Pressable>
      <MapTerrainActions point={point} onNavigate={() => void showNavigationChoices()} />
    </View>
  );
}

function kindLabel(kind: TripMapPoint["kind"]): string {
  if (kind === "stop") return "Étape";
  if (kind === "timeline") return "Moment";
  return "Trace";
}

function formatPointDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
