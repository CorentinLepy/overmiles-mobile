import { Linking } from "react-native";

import {
  createExternalNavigationTargets,
  type ExternalNavigationProvider,
} from "./external-navigation-targets";
import type { MapCoordinate } from "./map.types";

export type ResolvedExternalNavigationTarget = Readonly<{
  provider: ExternalNavigationProvider;
  label: string;
  url: string;
  opensInstalledApp: boolean;
}>;

type ResolveExternalNavigationInput = Readonly<{
  coordinate: MapCoordinate;
  destinationLabel?: string | null;
}>;

export async function resolveExternalNavigationTargets(
  input: ResolveExternalNavigationInput,
): Promise<readonly ResolvedExternalNavigationTarget[]> {
  const targets = createExternalNavigationTargets({
    coordinate: input.coordinate,
    platform: currentNavigationPlatform(),
    ...(input.destinationLabel !== undefined
      ? { destinationLabel: input.destinationLabel }
      : {}),
  });

  return Promise.all(
    targets.map(async (target) => {
      if (!target.probeUrl || !target.appUrl) {
        return Object.freeze({
          provider: target.provider,
          label: target.label,
          url: target.fallbackUrl,
          opensInstalledApp: false,
        });
      }

      let canOpenApp = false;
      try {
        canOpenApp = await Linking.canOpenURL(target.probeUrl);
      } catch {
        canOpenApp = false;
      }

      return Object.freeze({
        provider: target.provider,
        label: target.label,
        url: canOpenApp ? target.appUrl : target.fallbackUrl,
        opensInstalledApp: canOpenApp,
      });
    }),
  );
}

export async function openResolvedExternalNavigationTarget(
  target: ResolvedExternalNavigationTarget,
): Promise<void> {
  await Linking.openURL(target.url);
}

function currentNavigationPlatform(): "ios" | "android" {
  return process.env.EXPO_OS === "ios" ? "ios" : "android";
}
