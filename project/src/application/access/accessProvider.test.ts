import { beforeEach, describe, expect, it } from 'vitest';
import { LocalDevelopmentAccessProvider } from './accessProvider';
import { trialDurationMilliseconds } from '../../domain/access/types';

describe('LocalDevelopmentAccessProvider', () => {
  const start = Date.UTC(2026, 0, 1, 12, 0, 0);
  let now = start;
  const provider = (): LocalDevelopmentAccessProvider => new LocalDevelopmentAccessProvider({ now: () => now });

  beforeEach(() => { localStorage.clear(); now = start; });

  it('does not start a trial implicitly', async () => {
    await expect(provider().getAccess()).resolves.toMatchObject({ status: 'not_started', canRead: true, canWrite: false, canExport: true });
  });

  it('starts an explicit 72-hour trial and expires exactly at its deadline', async () => {
    const accessProvider = provider();
    await expect(accessProvider.startTrial()).resolves.toMatchObject({ status: 'trial', remainingMilliseconds: trialDurationMilliseconds, canWrite: true });
    now = start + trialDurationMilliseconds - 1;
    await expect(accessProvider.getAccess()).resolves.toMatchObject({ status: 'trial', canWrite: true });
    now = start + trialDurationMilliseconds;
    await expect(accessProvider.getAccess()).resolves.toMatchObject({ status: 'expired', remainingMilliseconds: 0, canWrite: false, canImport: false, canRestore: false, canExport: true });
  });

  it('activates permanent owner access only with the private owner token', async () => {
    const accessProvider = provider();

    await expect(accessProvider.activateOwner('invalid-token')).resolves.toMatchObject({ status: 'not_started', canWrite: false });
    await expect(accessProvider.activateOwner('gMvuGAmdulylgD4Us5vXe3E783vTQMQdbub_nKvnKm4')).resolves.toMatchObject({ status: 'active', canWrite: true, canImport: true });
    await expect(accessProvider.getAccess()).resolves.toMatchObject({ status: 'active', canWrite: true });
  });

});
