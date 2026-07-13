export interface SyncResult {
  synced: number;
  fromAppsScript: number;
  duration: number;
  syncId: string;
  startedAt: string;
  finishedAt: string;
  /** @deprecated Usar finishedAt. Mantido para não quebrar callers existentes. */
  timestamp: string;
}
