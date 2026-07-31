import { trialDurationMilliseconds, type AccessClock, type AccessState } from '../../domain/access/types';

export type DevelopmentAccessScenario = 'reset' | 'trial' | 'expired' | 'active' | 'unavailable';
export interface AccessProvider { getAccess(): Promise<AccessState>; startTrial(): Promise<AccessState>; simulate?(scenario: DevelopmentAccessScenario): Promise<AccessState>; }
interface StoredAccess { trialStartedAt?: string; active?: boolean; unavailable?: boolean; }
const storageKey = 'bankroll-pilot.access.local.v1';
const clock: AccessClock = { now: () => Date.now() };
const unavailable = (now: number): AccessState => ({ status: 'unavailable', trialStartedAt: null, trialExpiresAt: null, remainingMilliseconds: 0, canRead: true, canWrite: false, canImport: false, canRestore: false, canExport: true, lastCheckedAt: new Date(now).toISOString() });

export class LocalDevelopmentAccessProvider implements AccessProvider {
  constructor(private readonly accessClock: AccessClock = clock) {}
  private read(): StoredAccess { try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as StoredAccess; } catch { return {}; } }
  private state(record: StoredAccess): AccessState {
    const now = this.accessClock.now();
    const checkedAt = new Date(now).toISOString();
    if (record.unavailable === true) return unavailable(now);
    if (record.active === true) return { status: 'active', trialStartedAt: null, trialExpiresAt: null, remainingMilliseconds: 0, canRead: true, canWrite: true, canImport: true, canRestore: true, canExport: true, lastCheckedAt: checkedAt };
    if (record.trialStartedAt === undefined) return { status: 'not_started', trialStartedAt: null, trialExpiresAt: null, remainingMilliseconds: 0, canRead: true, canWrite: false, canImport: false, canRestore: false, canExport: true, lastCheckedAt: checkedAt };
    const start = new Date(record.trialStartedAt).getTime();
    const expiry = start + trialDurationMilliseconds;
    const remaining = Math.max(0, expiry - now);
    const granted = remaining > 0;
    return { status: granted ? 'trial' : 'expired', trialStartedAt: record.trialStartedAt, trialExpiresAt: new Date(expiry).toISOString(), remainingMilliseconds: remaining, canRead: true, canWrite: granted, canImport: granted, canRestore: granted, canExport: true, lastCheckedAt: checkedAt };
  }
  async getAccess(): Promise<AccessState> { return this.state(this.read()); }
  async startTrial(): Promise<AccessState> { const current = this.read(); if (current.trialStartedAt === undefined) localStorage.setItem(storageKey, JSON.stringify({ ...current, trialStartedAt: new Date(this.accessClock.now()).toISOString() })); return this.getAccess(); }
  async simulate(scenario: DevelopmentAccessScenario): Promise<AccessState> {
    const now = this.accessClock.now();
    if (scenario === 'reset') localStorage.removeItem(storageKey);
    if (scenario === 'trial') localStorage.setItem(storageKey, JSON.stringify({ trialStartedAt: new Date(now).toISOString() }));
    if (scenario === 'expired') localStorage.setItem(storageKey, JSON.stringify({ trialStartedAt: new Date(now - trialDurationMilliseconds).toISOString() }));
    if (scenario === 'active') localStorage.setItem(storageKey, JSON.stringify({ active: true }));
    if (scenario === 'unavailable') localStorage.setItem(storageKey, JSON.stringify({ unavailable: true }));
    return this.getAccess();
  }
}

export class UnavailableAccessProvider implements AccessProvider {
  async getAccess(): Promise<AccessState> { return unavailable(Date.now()); }
  async startTrial(): Promise<AccessState> { return unavailable(Date.now()); }
}

// The private beta has no backend: access and the 72-hour trial are stored locally in the browser.
// Development simulations remain unavailable in production because accessService guards them with import.meta.env.DEV.
export const accessProvider: AccessProvider = new LocalDevelopmentAccessProvider();
