import { Camera, GeoJSONSource, Layer, Map } from "@maplibre/maplibre-react-native";
import { usePathname } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { readPublicRuntimeConfig } from "@/src/config/env";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { createVisitedPointsFeatureCollection } from "../map-geojson";
import { getMapInitialViewState } from "../map-viewport";
import type { MapDataState, TripMapPoint } from "../map.types";
import { useMapData } from "../use-map-data";

export function MapScreen() {
  const theme = useOverMilesTheme();
  const pathname = usePathname();
  const runtimeConfig = useMemo(() => readPublicRuntimeConfig(), []);
  const isMapActive = pathname === "/map";
  const { state, isRefreshing, refresh } = useMapData(isMapActive);
  const points = pointsFromState(state);
  const featureCollection = useMemo(() => createVisitedPointsFeatureCollection(points), [points]);
  const initialViewState = useMemo(() => getMapInitialViewState(points), [points]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [mapStyleFailed, setMapStyleFailed] = useState(false);
  const selectedPoint = points.find((point) => point.id === selectedPointId) ?? null;
  const cameraKey = `${points.length}:${points[0]?.id ?? "empty"}:${points.at(-1)?.id ?? "empty"}`;

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
        <Camera key={cameraKey} initialViewState={initialViewState} />
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
              {statusLabel(state, points.length)}
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
      ) : points.length === 0 ? (
        <CenterCard
          title="Aucun repère géolocalisé pour le moment."
          description="Les étapes et moments avec coordonnées apparaîtront ici automatiquement."
        />
      ) : null}

      {selectedPoint ? (
        <SelectedPointCard point={selectedPoint} onClose={() => setSelectedPointId(null)} />
      ) : null}
    </View>
  );
}

function pointsFromState(state: MapDataState): readonly TripMapPoint[] {
  return state.status === "ready" || state.status === "offline" || state.status === "error"
    ? state.points
    : [];
}

function statusLabel(state: MapDataState, count: number): string {
  if (state.status === "loading" || state.status === "idle") return "Chargement des repères…";
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

function SelectedPointCard({ point, onClose }: { point: TripMapPoint; onClose: () => void }) {
  const theme = useOverMilesTheme();

  return (
    <View
      style={{
        position: "absolute",
        left: theme.spacing.md,
        right: theme.spacing.md,
        bottom: theme.spacing.md,
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
      {point.occurredAt ? (
        <Text selectable style={{ color: theme.color.ink, fontSize: 13 }}>
          {formatPointDate(point.occurredAt)}
        </Text>
      ) : null}
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
