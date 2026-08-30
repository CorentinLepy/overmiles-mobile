export type LocalDataWriteToken = number;

export class LocalDataSessionGuard {
  private generation = 0;
  private active = false;

  activate(): void {
    if (this.active) return;
    this.generation += 1;
    this.active = true;
  }

  invalidate(): void {
    this.generation += 1;
    this.active = false;
  }

  capture(): LocalDataWriteToken | null {
    return this.active ? this.generation : null;
  }

  canCommit(token: LocalDataWriteToken | null): boolean {
    return token !== null && this.active && token === this.generation;
  }
}

export const localDataSessionGuard = new LocalDataSessionGuard();
