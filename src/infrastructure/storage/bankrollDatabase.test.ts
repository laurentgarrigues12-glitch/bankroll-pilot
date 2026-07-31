import { describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { bankrollDatabase, openBankrollDatabase, type BankrollTransactionFactory } from './bankrollDatabase';

const legacy = async (version: 1 | 2): Promise<{ name: string; operation: { id: string; type: 'deposit'; amountCents: number; date: string; comment: string; createdAt: string } }> => {
  const name = `bankroll-migration-${version}-${crypto.randomUUID()}`;
  const database = await openDB(name, version, { upgrade(db) { db.createObjectStore('settings'); db.createObjectStore('importedHands', { keyPath: 'handId' }).createIndex('by-played-at', 'playedAt'); db.createObjectStore('imports', { keyPath: 'id' }); db.createObjectStore('financialOperations', { keyPath: 'id' }).createIndex('by-date', 'date'); if (version === 2) db.createObjectStore('winamaxFolder'); } });
  const operation = { id: 'legacy', type: 'deposit' as const, amountCents: 100, date: '2026-07-01', comment: 'legacy', createdAt: '2026-07-01T00:00:00.000Z' };
  await database.put('financialOperations', operation); if (version === 2) await database.put('winamaxFolder', { directoryName: 'Winamax', autoScanEnabled: true }, 'current'); database.close();
  return { name, operation };
};

describe('bankrollDatabase', () => {
  it.each([1, 2] as const)('migrates v%s non-destructively to v3', async (version) => {
    const fixture = await legacy(version); const database = await openBankrollDatabase(fixture.name);
    expect(database.version).toBe(3); expect([...database.objectStoreNames]).toEqual(expect.arrayContaining(['settings', 'importedHands', 'imports', 'financialOperations', 'winamaxFolder', 'winamaxScannedFiles']));
    expect(await database.get('financialOperations', fixture.operation.id)).toEqual(fixture.operation);
    if (version === 2) expect(await database.get('winamaxFolder', 'current')).toMatchObject({ directoryName: 'Winamax', autoScanEnabled: true });
    database.close(); await deleteDB(fixture.name);
  });
  it('persists settings and financial operations', async () => {
    await bankrollDatabase.saveSettings({ id: 'current', initialBankrollCents: 25000, currency: 'EUR', startDate: '2026-07-01' });
    await bankrollDatabase.saveOperation({ id: 'operation-test', type: 'deposit', amountCents: 1000, date: '2026-07-30', comment: '', createdAt: '2026-07-30T00:00:00.000Z' });
    expect(await bankrollDatabase.getSettings()).toMatchObject({ initialBankrollCents: 25000 });
    expect(await bankrollDatabase.getOperations()).toHaveLength(1);
    await bankrollDatabase.deleteOperation('operation-test');
  });

  it('saves an import batch atomically and ignores deterministic duplicates', async () => {
    const operation = { id: 'winamax:source', type: 'deposit' as const, amountCents: 1250, date: '2026-07-30', comment: 'Source Winamax', createdAt: '2026-07-30T00:00:00.000Z' };

    expect(await bankrollDatabase.saveOperationsIfNew([operation, operation])).toEqual({ savedCount: 1, duplicateCount: 1 });
    expect(await bankrollDatabase.saveOperationsIfNew([operation])).toEqual({ savedCount: 0, duplicateCount: 1 });
    await bankrollDatabase.deleteOperation(operation.id);
  });

  it('marks every source file together with its confirmed folder import', async () => {
    const source = (fingerprint: string, fileName: string) => ({ fingerprint, fileName, size: 1, lastModified: 1, fileKind: 'history' as const, status: 'importable' as const, firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T00:00:00.000Z' });
    await bankrollDatabase.saveWinamaxScannedFiles([source('history|1|1', 'history.txt'), { ...source('summary|1|1', 'history_summary.txt'), fileKind: 'summary' }]);
    const operation = { id: 'winamax:tournament:1:hero', type: 'adjustment' as const, amountCents: 10, date: '2026-07-30', comment: 'Tournament', createdAt: '2026-07-30T00:00:00.000Z', source: 'winamax' as const, sourceId: 'tournament:1:hero' };
    expect(await bankrollDatabase.saveWinamaxFolderImport([operation], { 'tournament:1:hero': ['history|1|1', 'summary|1|1'] })).toEqual({ savedCount: 1, duplicateCount: 0 });
    expect(await bankrollDatabase.getWinamaxScannedFile('history|1|1')).toMatchObject({ status: 'imported' });
    expect(await bankrollDatabase.getWinamaxScannedFile('summary|1|1')).toMatchObject({ status: 'imported' });
    expect(await bankrollDatabase.saveWinamaxFolderImport([operation], { 'tournament:1:hero': ['history|1|1', 'summary|1|1'] })).toEqual({ savedCount: 0, duplicateCount: 1 });
    expect(await bankrollDatabase.getWinamaxScannedFile('history|1|1')).toMatchObject({ status: 'duplicate' });
    await bankrollDatabase.deleteOperation(operation.id);
  });

  it('uses an injected idb transaction factory while preserving the nominal import', async () => {
    const source = (fingerprint: string) => ({ fingerprint, fileName: fingerprint, size: 1, lastModified: 1, fileKind: 'history' as const, status: 'importable' as const, firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T00:00:00.000Z' });
    await bankrollDatabase.saveWinamaxScannedFiles([source('factory-history'), { ...source('factory-summary'), fileKind: 'summary' }]);
    let calls = 0; let receivedDatabase: unknown;
    const factory: BankrollTransactionFactory = (database) => { calls += 1; receivedDatabase = database; return database.transaction(['financialOperations', 'winamaxScannedFiles'], 'readwrite'); };
    const operation = { id: 'winamax:factory', type: 'adjustment' as const, amountCents: 1, date: '2026-07-30', comment: 'Factory', createdAt: '2026-07-30T00:00:00.000Z', source: 'winamax' as const, sourceId: 'factory' };
    expect(await bankrollDatabase.saveWinamaxFolderImport([operation], { factory: ['factory-history', 'factory-summary'] }, factory)).toEqual({ savedCount: 1, duplicateCount: 0 });
    expect(calls).toBe(1); expect(receivedDatabase).toBeDefined(); expect(await bankrollDatabase.getWinamaxScannedFile('factory-history')).toMatchObject({ status: 'imported' }); expect(await bankrollDatabase.getWinamaxScannedFile('factory-summary')).toMatchObject({ status: 'imported' });
    await bankrollDatabase.deleteOperation(operation.id);
  });

  it('rolls back an aborted import and allows the same batch to be retried', async () => {
    const source = (fingerprint: string) => ({ fingerprint, fileName: fingerprint, size: 1, lastModified: 1, fileKind: 'history' as const, status: 'importable' as const, firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T00:00:00.000Z' });
    const fingerprints = ['abort-history', 'abort-summary'];
    await bankrollDatabase.saveWinamaxScannedFiles([source(fingerprints[0]), { ...source(fingerprints[1]), fileKind: 'summary' }]);
    const factory: BankrollTransactionFactory = (database) => {
      const transaction = database.transaction(['financialOperations', 'winamaxScannedFiles'], 'readwrite');
      void transaction.done.catch(() => undefined);
      transaction.abort();
      return transaction;
    };
    const operation = { id: 'winamax:abort', type: 'adjustment' as const, amountCents: 1, date: '2026-07-30', comment: 'Abort', createdAt: '2026-07-30T00:00:00.000Z', source: 'winamax' as const, sourceId: 'abort' };
    const sources = { abort: fingerprints };

    await expect(bankrollDatabase.saveWinamaxFolderImport([operation], sources, factory)).rejects.toThrow();
    expect((await bankrollDatabase.getOperations()).find((item) => item.id === operation.id)).toBeUndefined();
    expect(await bankrollDatabase.getWinamaxScannedFile(fingerprints[0])).toMatchObject({ status: 'importable' });
    expect(await bankrollDatabase.getWinamaxScannedFile(fingerprints[1])).toMatchObject({ status: 'importable' });

    expect(await bankrollDatabase.saveWinamaxFolderImport([operation], sources)).toEqual({ savedCount: 1, duplicateCount: 0 });
    expect((await bankrollDatabase.getOperations()).filter((item) => item.id === operation.id)).toHaveLength(1);
    expect(await bankrollDatabase.getWinamaxScannedFile(fingerprints[0])).toMatchObject({ status: 'imported' });
    expect(await bankrollDatabase.getWinamaxScannedFile(fingerprints[1])).toMatchObject({ status: 'imported' });

    const database = await openBankrollDatabase();
    const cleanup = database.transaction(['financialOperations', 'winamaxScannedFiles'], 'readwrite');
    await cleanup.objectStore('financialOperations').delete(operation.id);
    for (const fingerprint of fingerprints) await cleanup.objectStore('winamaxScannedFiles').delete(fingerprint);
    await cleanup.done;
    database.close();
  });

  it('excludes local Winamax folder data from backups and preserves it during restore', async () => {
    const directoryHandle = { kind: 'directory', name: 'Winamax' } as unknown as FileSystemDirectoryHandle;
    const configuration = { directoryHandle, directoryName: 'Winamax', selectedAt: '2026-07-30T00:00:00.000Z', lastScanAt: '2026-07-30T01:00:00.000Z', autoScanEnabled: true };
    const scannedFile = { fingerprint: 'backup-local-history', fileName: 'history.txt', size: 42, lastModified: 1, fileKind: 'history' as const, status: 'importable' as const, firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T01:00:00.000Z' };
    await bankrollDatabase.saveWinamaxFolderConfiguration(configuration);
    await bankrollDatabase.saveWinamaxScannedFiles([scannedFile]);

    const backup = await bankrollDatabase.getBackupData();
    expect(backup).not.toHaveProperty('winamaxFolder');
    expect(backup).not.toHaveProperty('winamaxScannedFiles');
    expect(JSON.stringify(backup)).not.toContain('backup-local-history');
    expect(JSON.stringify(backup)).not.toContain('directoryHandle');

    await bankrollDatabase.replaceBackupData({ settings: { id: 'current', initialBankrollCents: 12345, currency: 'EUR', startDate: '2026-07-01' }, operations: [], hands: [], imports: [] });

    expect(await bankrollDatabase.getWinamaxFolderConfiguration()).toEqual(configuration);
    expect(await bankrollDatabase.getWinamaxScannedFile(scannedFile.fingerprint)).toEqual(scannedFile);

    const database = await openBankrollDatabase();
    const cleanup = database.transaction(['winamaxFolder', 'winamaxScannedFiles'], 'readwrite');
    await cleanup.objectStore('winamaxFolder').delete('current');
    await cleanup.objectStore('winamaxScannedFiles').delete(scannedFile.fingerprint);
    await cleanup.done;
    database.close();
  });

  it('resets bankroll data while preserving the selected Winamax folder', async () => {
    const directoryHandle = { kind: 'directory', name: 'Winamax' } as unknown as FileSystemDirectoryHandle;
    const configuration = { directoryHandle, directoryName: 'Winamax', selectedAt: '2026-07-30T00:00:00.000Z', lastScanAt: '2026-07-30T01:00:00.000Z', autoScanEnabled: true };
    const scannedFile = { fingerprint: 'reset-history', fileName: 'history.txt', size: 42, lastModified: 1, fileKind: 'history' as const, status: 'imported' as const, firstSeenAt: '2026-07-30T00:00:00.000Z', lastSeenAt: '2026-07-30T01:00:00.000Z' };
    await bankrollDatabase.saveSettings({ id: 'current', initialBankrollCents: 25000, currency: 'EUR', startDate: '2026-07-01' });
    await bankrollDatabase.saveOperation({ id: 'reset-operation', type: 'deposit', amountCents: 1000, date: '2026-07-30', comment: '', createdAt: '2026-07-30T00:00:00.000Z' });
    await bankrollDatabase.saveWinamaxFolderConfiguration(configuration);
    await bankrollDatabase.saveWinamaxScannedFiles([scannedFile]);

    await bankrollDatabase.resetBankrollData();

    expect(await bankrollDatabase.getSettings()).toBeUndefined();
    expect(await bankrollDatabase.getOperations()).toEqual([]);
    expect(await bankrollDatabase.getHands()).toEqual([]);
    expect(await bankrollDatabase.getImports()).toEqual([]);
    expect(await bankrollDatabase.getWinamaxScannedFiles()).toEqual([]);
    expect(await bankrollDatabase.getWinamaxFolderConfiguration()).toEqual(configuration);

    await bankrollDatabase.deleteWinamaxFolderConfiguration();
  });

  it('replaces all stores atomically from a backup while preserving imported identifiers', async () => {
    await bankrollDatabase.saveOperation({ id: 'old', type: 'deposit', amountCents: 1, date: '2026-07-01', comment: '', createdAt: '2026-07-01T00:00:00.000Z' });
    await bankrollDatabase.replaceBackupData({ settings: { id: 'current', initialBankrollCents: 20000, currency: 'EUR', startDate: '2026-07-01' }, operations: [{ id: 'winamax:stable', type: 'withdrawal', amountCents: 500, date: '2026-07-02', comment: 'Imported', createdAt: '2026-07-02T00:00:00.000Z' }], hands: [], imports: [] });
    expect(await bankrollDatabase.getOperations()).toEqual([expect.objectContaining({ id: 'winamax:stable' })]);
    expect(await bankrollDatabase.getSettings()).toMatchObject({ initialBankrollCents: 20000 });
    await bankrollDatabase.deleteOperation('winamax:stable');
  });
});
