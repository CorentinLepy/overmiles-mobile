/** Contract reserved for the encrypted offline database implemented in COR-56. */
export interface LocalDatabase {
  open(): Promise<void>;
  close(): Promise<void>;
  purge(): Promise<void>;
}
