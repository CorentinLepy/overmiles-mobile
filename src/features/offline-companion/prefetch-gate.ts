import type { PrefetchStoragePressureResult } from "./storage-pressure-policy";
import {
  decideResourcePrefetch,
  type ResourcePrefetchCandidate,
  type ResourcePrefetchContext,
  type ResourcePrefetchResult,
} from "./resource-prefetch-policy";

export type CompanionPrefetchGateResult = Readonly<{
  decision: "allow" | "defer";
  source: "storage" | "resources";
  reason: PrefetchStoragePressureResult["reason"] | ResourcePrefetchResult["reason"];
}>;

export function decideCompanionPrefetch(
  storagePressure: PrefetchStoragePressureResult,
  candidate: ResourcePrefetchCandidate,
  resources: ResourcePrefetchContext,
): CompanionPrefetchGateResult {
  if (storagePressure.decision === "stop_prefetch") {
    return {
      decision: "defer",
      source: "storage",
      reason: storagePressure.reason,
    };
  }

  const resourceDecision = decideResourcePrefetch(candidate, resources);
  return {
    decision: resourceDecision.decision,
    source: "resources",
    reason: resourceDecision.reason,
  };
}
