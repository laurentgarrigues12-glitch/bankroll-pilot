export type WinamaxScannedFileStatus = 'detected' | 'incomplete' | 'importable' | 'imported' | 'duplicate' | 'invalid';
export type WinamaxScannedFileKind = 'history' | 'summary' | 'unknown';

export interface WinamaxScannedFileRecord {
  fingerprint: string;
  fileName: string;
  size: number;
  lastModified: number;
  /** Identifies the parsed tournament group when the file is recognised. */
  groupKey?: string;
  tournamentId?: string;
  fileKind: WinamaxScannedFileKind;
  status: WinamaxScannedFileStatus;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** The only place where a scan may decide a registry status. */
export const winamaxScannedFileStatus = (input: { hasParseError: boolean; isIncomplete: boolean; isImportable: boolean }): WinamaxScannedFileStatus => {
  if (input.hasParseError) return 'invalid';
  if (input.isIncomplete) return 'incomplete';
  if (input.isImportable) return 'importable';
  return 'detected';
};
