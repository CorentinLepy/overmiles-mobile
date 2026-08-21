export type SyncState = "idle" | "pending" | "syncing" | "failed" | "conflict";

/** Contract reserved for the offline synchronization engine implemented in COR-57. */
export interface SyncEngine {
  getState(): SyncState;
  requestSync(): Promise<void>;
}
