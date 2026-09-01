export class CompanionPrefetchFlightRegistry {
  private readonly inFlightKeys = new Set<string>();
  private readonly completedKeys = new Set<string>();

  tryStart(key: string): boolean {
    if (this.inFlightKeys.has(key) || this.completedKeys.has(key)) return false;
    this.inFlightKeys.add(key);
    return true;
  }

  finish(key: string, succeeded: boolean): void {
    this.inFlightKeys.delete(key);
    if (succeeded) this.completedKeys.add(key);
  }

  isInFlight(key: string): boolean {
    return this.inFlightKeys.has(key);
  }

  isCompleted(key: string): boolean {
    return this.completedKeys.has(key);
  }
}
