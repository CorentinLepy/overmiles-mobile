import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";

import { SectionCard } from "@/src/components/ui/section-card";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import { localDatabase } from "@/src/lib/storage/local-database";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import type { LocalMediaItem } from "../local-media-item";
import { localMediaStore } from "../local-media-store";
import {
  choosePhotosFromLibrary,
  recoverPendingPhotoCapture,
  takePhotoWithCamera,
  type NativePhotoCaptureResult,
} from "../native-photo-capture";
import { secureMediaStaging } from "../secure-media-staging";

type CaptureStatus = Readonly<{
  kind: "idle" | "busy" | "saved" | "error" | "permission_denied";
  message: string;
}>;

const IDLE_STATUS: CaptureStatus = {
  kind: "idle",
  message: "Les photos choisies sont d’abord enregistrées en privé sur cet appareil.",
};

export function PhotoCaptureScreen({ tripId }: { tripId: string }) {
  const theme = useOverMilesTheme();
  const { user } = useAuth();
  const { findTrip, isLoading } = useTripsData();
  const trip = findTrip(tripId);
  const accountUserId = user?.id ?? null;
  const loadKey = accountUserId ? `${accountUserId}:${tripId}` : null;
  const recoveredLoadKeyRef = useRef<string | null>(null);
  const [items, setItems] = useState<readonly LocalMediaItem[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptureStatus>(IDLE_STATUS);

  const reloadItems = useCallback(async () => {
    if (!accountUserId || !loadKey) return;
    const generation = localDatabase.captureGeneration();
    const nextItems = await localMediaStore.listForTrip(accountUserId, tripId, generation);
    if (!localDatabase.canUseGeneration(generation)) return;
    setItems(nextItems);
    setLoadedKey(loadKey);
  }, [accountUserId, loadKey, tripId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void reloadItems().catch(() => {
        if (active) {
          setStatus({ kind: "error", message: "Impossible de relire les photos locales." });
        }
      });
      return () => {
        active = false;
      };
    }, [reloadItems]),
  );

  useEffect(() => {
    if (!accountUserId || !loadKey || recoveredLoadKeyRef.current === loadKey) return;
    recoveredLoadKeyRef.current = loadKey;
    let active = true;

    void recoverPendingPhotoCapture({ accountUserId, tripId }).then((result) => {
      if (!active || !result) return;
      if (result.status === "saved") {
        setStatus(captureStatusFromResult(result));
        void reloadItems();
      } else if (result.status === "failed") {
        setStatus({
          kind: "error",
          message: result.message ?? "La sélection précédente n’a pas pu être récupérée.",
        });
      }
    });

    return () => {
      active = false;
    };
  }, [accountUserId, loadKey, reloadItems, tripId]);

  async function runCapture(
    capture: () => Promise<NativePhotoCaptureResult>,
    busyMessage: string,
  ) {
    if (status.kind === "busy") return;
    setStatus({ kind: "busy", message: busyMessage });

    const result = await capture();
    setStatus(captureStatusFromResult(result));
    if (result.status === "saved") await reloadItems();
  }

  async function discard(item: LocalMediaItem) {
    if (status.kind === "busy") return;
    setStatus({ kind: "busy", message: "Suppression de la photo…" });
    try {
      const removed = await secureMediaStaging.discard(item);
      setStatus(
        removed
          ? { kind: "saved", message: "Photo supprimée de cet appareil." }
          : { kind: "error", message: "La photo n’a pas pu être supprimée." },
      );
      if (removed) await reloadItems();
    } catch {
      setStatus({ kind: "error", message: "La photo n’a pas pu être supprimée." });
    }
  }

  if (!user || (!trip && !isLoading)) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: theme.color.canvas }}
        contentContainerStyle={{ padding: theme.spacing.lg }}
      >
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
            Photos indisponibles
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            Ce voyage n’est pas disponible sur cet appareil pour le moment.
          </Text>
        </SectionCard>
      </ScrollView>
    );
  }

  const visibleItems = loadedKey === loadKey ? items : [];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.color.canvas }}
      contentContainerStyle={{
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
      }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text
          selectable
          style={{
            color: theme.color.ink,
            fontSize: 30,
            lineHeight: 35,
            fontWeight: "800",
            letterSpacing: -0.7,
          }}
        >
          Ajouter des photos
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          {trip ? trip.name : "Votre voyage"}
        </Text>
      </View>

      <SectionCard>
        <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
          Capture rapide
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 14, lineHeight: 21 }}>
          Choisissez plusieurs photos ou prenez-en une maintenant. L’enregistrement local fonctionne
          même sans réseau.
        </Text>

        <CaptureButton
          label="Choisir des photos"
          accessibilityLabel={`Choisir des photos pour ${trip?.name ?? "ce voyage"}`}
          disabled={status.kind === "busy" || !accountUserId}
          primary
          onPress={() => {
            if (!accountUserId) return;
            void runCapture(
              () => choosePhotosFromLibrary({ accountUserId, tripId }),
              "Ouverture de la photothèque…",
            );
          }}
        />
        <CaptureButton
          label="Prendre une photo"
          accessibilityLabel={`Prendre une photo pour ${trip?.name ?? "ce voyage"}`}
          disabled={status.kind === "busy" || !accountUserId}
          onPress={() => {
            if (!accountUserId) return;
            void runCapture(
              () => takePhotoWithCamera({ accountUserId, tripId }),
              "Ouverture de l’appareil photo…",
            );
          }}
        />

        <View
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={status.message}
          style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}
        >
          {status.kind === "busy" ? <ActivityIndicator size="small" /> : null}
          <Text
            selectable
            style={{
              flex: 1,
              color:
                status.kind === "error" || status.kind === "permission_denied"
                  ? theme.color.warning
                  : theme.color.muted,
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            {status.message}
          </Text>
        </View>

        {status.kind === "permission_denied" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les réglages de l’application"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => ({ alignSelf: "flex-start", opacity: pressed ? 0.65 : 1 })}
          >
            <Text style={{ color: theme.color.accent, fontSize: 13, fontWeight: "800" }}>
              Ouvrir les réglages
            </Text>
          </Pressable>
        ) : null}
      </SectionCard>

      {visibleItems.length > 0 ? (
        <SectionCard>
          <View style={{ gap: theme.spacing.xs }}>
            <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
              Sur cet appareil · {visibleItems.length}
            </Text>
            <Text selectable style={{ color: theme.color.muted, fontSize: 13, lineHeight: 19 }}>
              Ces fichiers privés sont conservés jusqu’à leur synchronisation ou leur suppression.
            </Text>
          </View>

          {visibleItems.map((item) => (
            <LocalPhotoRow
              key={item.localMediaId}
              item={item}
              disabled={status.kind === "busy"}
              onDiscard={() => void discard(item)}
            />
          ))}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function CaptureButton({
  label,
  accessibilityLabel,
  disabled,
  primary = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = useOverMilesTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.radius.pill,
        borderWidth: primary ? 0 : 1,
        borderColor: theme.color.border,
        backgroundColor: primary ? theme.color.ink : theme.color.surface,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: primary ? theme.color.surface : theme.color.ink,
          fontSize: 14,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LocalPhotoRow({
  item,
  disabled,
  onDiscard,
}: {
  item: LocalMediaItem;
  disabled: boolean;
  onDiscard: () => void;
}) {
  const theme = useOverMilesTheme();
  const title = item.originalFilename || `Photo ${formatLocalDate(item.capturedAt ?? item.createdAt)}`;

  return (
    <View
      style={{
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
        borderRadius: theme.radius.control,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: theme.color.surfaceMuted,
      }}
    >
      <Text selectable numberOfLines={1} style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>
        {title}
      </Text>
      <Text selectable style={{ color: theme.color.muted, fontSize: 12, lineHeight: 18 }}>
        {mediaStateLabel(item)}
        {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Supprimer ${title} de cet appareil`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onDiscard}
        style={({ pressed }) => ({ alignSelf: "flex-start", opacity: disabled ? 0.4 : pressed ? 0.65 : 1 })}
      >
        <Text style={{ color: theme.color.warning, fontSize: 12, fontWeight: "800" }}>Supprimer</Text>
      </Pressable>
    </View>
  );
}

function captureStatusFromResult(result: NativePhotoCaptureResult): CaptureStatus {
  if (result.status === "saved") {
    const count = result.saved.length;
    return {
      kind: "saved",
      message:
        result.message ??
        `${count} photo${count > 1 ? "s" : ""} enregistrée${count > 1 ? "s" : ""} sur cet appareil.`,
    };
  }
  if (result.status === "permission_denied") {
    return {
      kind: "permission_denied",
      message: result.message ?? "L’accès à l’appareil photo est nécessaire.",
    };
  }
  if (result.status === "failed") {
    return { kind: "error", message: result.message ?? "La capture n’a pas pu être enregistrée." };
  }
  return IDLE_STATUS;
}

function mediaStateLabel(item: LocalMediaItem): string {
  switch (item.state) {
    case "local_only":
      return "Enregistrée sur cet appareil";
    case "ready_to_upload":
      return "Prête à synchroniser";
    case "uploading":
      return "Synchronisation en cours";
    case "failed":
      return "À reprendre";
  }
}

function formatLocalDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "locale";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
