import type { CompanionTripStoragePriority, OfflineStorageClass } from "./storage-policy";

export type PrefetchContentWeight = "light" | "heavy";
export type PrefetchNetworkClass = "offline" | "constrained" | "cellular" | "wifi" | "unknown";
export type PrefetchBatteryClass = "critical" | "low" | "normal" | "charging" | "unknown";
export type ResourcePrefetchDecision = "allow" | "defer";

export type ResourcePrefetchContext = Readonly<{
  network: PrefetchNetworkClass;
  battery: PrefetchBatteryClass;
  lowPowerMode: boolean | null;
}>;

export type ResourcePrefetchCandidate = Readonly<{
  storageClass: OfflineStorageClass;
  tripPriority: CompanionTripStoragePriority;
  contentWeight: PrefetchContentWeight;
}>;

export type ResourcePrefetchResult = Readonly<{
  decision: ResourcePrefetchDecision;
  reason:
    | "protected_data"
    | "lightweight_business_data"
    | "favorable"
    | "offline"
    | "constrained_network"
    | "cellular_non_current"
    | "battery_critical"
    | "battery_low"
    | "low_power_mode"
    | "unknown_resources";
}>;

export function decideResourcePrefetch(
  candidate: ResourcePrefetchCandidate,
  context: ResourcePrefetchContext,
): ResourcePrefetchResult {
  if (candidate.storageClass === "private_unsynced") {
    return { decision: "allow", reason: "protected_data" };
  }

  if (candidate.storageClass === "durable_business" || candidate.contentWeight === "light") {
    return { decision: "allow", reason: "lightweight_business_data" };
  }

  if (context.network === "offline") {
    return { decision: "defer", reason: "offline" };
  }

  if (context.battery === "critical") {
    return { decision: "defer", reason: "battery_critical" };
  }

  if (context.lowPowerMode === true) {
    return { decision: "defer", reason: "low_power_mode" };
  }

  if (context.network === "unknown" || context.battery === "unknown" || context.lowPowerMode === null) {
    return { decision: "defer", reason: "unknown_resources" };
  }

  if (context.network === "constrained") {
    return { decision: "defer", reason: "constrained_network" };
  }

  if (context.battery === "low" && candidate.tripPriority !== "current") {
    return { decision: "defer", reason: "battery_low" };
  }

  if (
    context.network === "cellular" &&
    candidate.tripPriority !== "current" &&
    context.battery !== "charging"
  ) {
    return { decision: "defer", reason: "cellular_non_current" };
  }

  return { decision: "allow", reason: "favorable" };
}
