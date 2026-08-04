import { beforeEach, describe, expect, it } from 'vitest';
import { bankrollService } from './bankrollService';
import { bankrollDatabase } from '../../infrastructure/storage/bankrollDatabase';

const heroTournament = { type: 'adjustment' as const, amountCents: 0, date: '2026-07-25', comment: 'Expresso Nitro Freeroll — 3e sur 3 — 5 mains', importKey: 'tournament:1155086037:hero' };

describe('bankrollService.importWinamaxOperations', () => {
  beforeEach(async () => {
    localStorage.setItem('bankroll-pilot.access.local.v1', JSON.stringify({ active: true }));
    for (const operation of await bankrollDatabase.getOperations()) await bankrollDatabase.deleteOperation(operation.id);
  });

  it('persists a zero-result tournament once and reports its reimport as a duplicate', async () => {
    await expect(bankrollService.importWinamaxOperations([heroTournament])).resolves.toEqual({ importedCount: 1, duplicateCount: 0 });
    expect(await bankrollDatabase.getOperations()).toEqual([expect.objectContaining({ id: 'winamax:tournament:1155086037:hero', amountCents: 0, type: 'adjustment', comment: heroTournament.comment })]);
    await expect(bankrollService.importWinamaxOperations([heroTournament])).resolves.toEqual({ importedCount: 0, duplicateCount: 1 });
    expect(await bankrollDatabase.getOperations()).toHaveLength(1);
  });

  it('keeps another player in the same tournament as a separate import', async () => {
    await bankrollService.importWinamaxOperations([heroTournament]);
    await expect(bankrollService.importWinamaxOperations([{ ...heroTournament, importKey: 'tournament:1155086037:player2' }])).resolves.toEqual({ importedCount: 1, duplicateCount: 0 });
    expect(await bankrollDatabase.getOperations()).toHaveLength(2);
  });

  it('upgrades a matching legacy tournament instead of creating a duplicate', async () => {
    await bankrollDatabase.saveOperation({ id: 'tournament:1155831676:maltau', type: 'adjustment', amountCents: -1000, date: '2026-07-25', comment: 'Legacy tournament', createdAt: '2026-07-25T12:00:00.000Z', sourceId: 'tournament:1155831676:maltau' });

    await expect(bankrollService.importWinamaxOperations([{ type: 'adjustment', amountCents: -1000, date: '2026-07-25', comment: 'Legacy tournament', importKey: 'tournament:1155831676:maltau' }])).resolves.toEqual({ importedCount: 0, duplicateCount: 1 });
    expect(await bankrollDatabase.getOperations()).toEqual([expect.objectContaining({ id: 'tournament:1155831676:maltau', source: 'winamax', sourceId: 'tournament:1155831676:maltau' })]);
  });

  it('repairs legacy imports once and leaves the second repair unchanged', async () => {
    await bankrollDatabase.saveOperation({ id: 'tournament:1155831676:maltau', type: 'adjustment', amountCents: -1000, date: '2026-07-25', comment: 'Legacy tournament', createdAt: '2026-07-25T12:00:00.000Z', sourceId: 'tournament:1155831676:maltau' });

    await expect(bankrollService.repairLegacyWinamaxOperations()).resolves.toEqual({ repairedCount: 1 });
    await expect(bankrollService.repairLegacyWinamaxOperations()).resolves.toEqual({ repairedCount: 0 });
  });

  it('treats a folder import as a duplicate after the same tournament was imported manually', async () => {
    await bankrollService.importWinamaxOperations([heroTournament]);
    await bankrollDatabase.saveWinamaxScannedFiles([
      { fingerprint: 'cross-manual-folder-history', fileName: 'history.txt', size: 1, lastModified: 1, fileKind: 'history', status: 'importable', firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T00:00:00.000Z' },
      { fingerprint: 'cross-manual-folder-summary', fileName: 'history_summary.txt', size: 1, lastModified: 1, fileKind: 'summary', status: 'importable', firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T00:00:00.000Z' },
    ]);

    await expect(bankrollService.importWinamaxFolderOperations([heroTournament], {
      [heroTournament.importKey]: ['cross-manual-folder-history', 'cross-manual-folder-summary'],
    })).resolves.toEqual({ importedCount: 0, duplicateCount: 1 });

    expect(await bankrollDatabase.getOperations()).toHaveLength(1);
    expect(await bankrollDatabase.getWinamaxScannedFile('cross-manual-folder-history')).toMatchObject({ status: 'duplicate' });
    expect(await bankrollDatabase.getWinamaxScannedFile('cross-manual-folder-summary')).toMatchObject({ status: 'duplicate' });
  });

  it('treats a manual import as a duplicate after the same tournament was imported from a folder', async () => {
    await bankrollDatabase.saveWinamaxScannedFiles([
      { fingerprint: 'cross-folder-manual-history', fileName: 'history.txt', size: 1, lastModified: 1, fileKind: 'history', status: 'importable', firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T00:00:00.000Z' },
      { fingerprint: 'cross-folder-manual-summary', fileName: 'history_summary.txt', size: 1, lastModified: 1, fileKind: 'summary', status: 'importable', firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T00:00:00.000Z' },
    ]);
    await expect(bankrollService.importWinamaxFolderOperations([heroTournament], {
      [heroTournament.importKey]: ['cross-folder-manual-history', 'cross-folder-manual-summary'],
    })).resolves.toEqual({ importedCount: 1, duplicateCount: 0 });

    await expect(bankrollService.importWinamaxOperations([heroTournament])).resolves.toEqual({ importedCount: 0, duplicateCount: 1 });

    expect(await bankrollDatabase.getOperations()).toHaveLength(1);
    expect(await bankrollDatabase.getWinamaxScannedFile('cross-folder-manual-history')).toMatchObject({ status: 'imported' });
    expect(await bankrollDatabase.getWinamaxScannedFile('cross-folder-manual-summary')).toMatchObject({ status: 'imported' });
  });

});
