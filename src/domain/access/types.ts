export type AccessStatus = 'not_started' | 'trial' | 'active' | 'expired' | 'unavailable';
export type AccessAction = 'create-operation' | 'import-winamax' | 'save-settings' | 'restore-backup' | 'export-backup';

export interface AccessState {
  status: AccessStatus;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  remainingMilliseconds: number;
  canRead: boolean;
  canWrite: boolean;
  canImport: boolean;
  canRestore: boolean;
  canExport: boolean;
  lastCheckedAt: string;
}

export interface AccessClock { now: () => number; }
export const trialDurationMilliseconds = 72 * 60 * 60 * 1000;

export const canPerform = (access: AccessState, action: AccessAction): boolean => {
  if (action === 'export-backup') return access.canExport;
  if (action === 'import-winamax') return access.canImport;
  if (action === 'restore-backup') return access.canRestore;
  return access.canWrite;
};
