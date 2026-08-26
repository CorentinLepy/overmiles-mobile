import * as SQLite from "expo-sqlite";

import { DatabaseKeyStore } from "./database-key-store";
import { runLocalMigrations } from "./migrations";

const DATABASE_NAME = "overmiles.db";
const DATABASE_KEY_PATTERN = /^[0-9a-f]{64}$/;

function sqlCipherKeyPragma(hexKey: string): string {
  if (!DATABASE_KEY_PATTERN.test(hexKey)) {
    throw new Error("Format de clé SQLCipher invalide.");
  }
  return `PRAGMA key = \"x'${hexKey}'\";`;
}

export class LocalDatabase {
  private database: SQLite.SQLiteDatabase | null = null;
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;

  constructor(private readonly keyStore = new DatabaseKeyStore()) {}

  async open(): Promise<SQLite.SQLiteDatabase> {
    if (this.database) return this.database;
    if (!this.opening) {
      this.opening = this.openEncryptedDatabase().finally(() => {
        this.opening = null;
      });
    }
    return this.opening;
  }

  async close(): Promise<void> {
    if (!this.database) return;
    await this.database.closeAsync();
    this.database = null;
  }

  async purge(): Promise<void> {
    await this.close();
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
    await this.keyStore.clearKey();
  }

  private async recoverMissingKey(): Promise<string> {
    // A SQLCipher database without its device-bound key is intentionally unrecoverable.
    // Never generate a replacement key and reuse the old encrypted file: remove the
    // inaccessible cache first, then rebuild it from the server source of truth.
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
    return this.keyStore.createKey();
  }

  private async openEncryptedDatabase(): Promise<SQLite.SQLiteDatabase> {
    const storedKey = await this.keyStore.readKey();
    const key = storedKey ?? (await this.recoverMissingKey());
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    try {
      await db.execAsync(sqlCipherKeyPragma(key));
      await db.getFirstAsync("SELECT count(*) AS count FROM sqlite_master");
      await db.execAsync("PRAGMA foreign_keys = ON;");
      await db.execAsync("PRAGMA journal_mode = WAL;");
      await runLocalMigrations(db);
      this.database = db;
      return db;
    } catch (error) {
      await db.closeAsync().catch(() => undefined);
      throw error;
    }
  }
}

export const localDatabase = new LocalDatabase();
