import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configuration: undefined as { directoryHandle: FileSystemDirectoryHandle; directoryName: string; selectedAt: string; autoScanEnabled: boolean } | undefined,
  permission: 'granted' as PermissionState,
  requestedPermission: 'granted' as PermissionState,
  files: [] as { relativeName: string; file: File }[],
  records: new Map<string, { fingerprint: string; status: string }>(),
  getPermission: vi.fn(), requestPermission: vi.fn(), readFolder: vi.fn(), preview: vi.fn(), saveRecords: vi.fn(), saveConfiguration: vi.fn(), getRecord: vi.fn(), getRecords: vi.fn(),
}));

vi.mock('../../infrastructure/filesystem/fileSystemAccessSupport', () => ({
  getDirectoryPermission: mocks.getPermission,
  requestDirectoryPermission: mocks.requestPermission,
}));
vi.mock('../../infrastructure/filesystem/winamaxFolderGateway', () => ({
  readWinamaxFolder: mocks.readFolder,
  fingerprintWinamaxFile: (file: File, relativeName: string) => `${relativeName.toLowerCase()}|${file.size}|${file.lastModified}`,
}));
vi.mock('../../infrastructure/storage/bankrollDatabase', () => ({ bankrollDatabase: {
  getWinamaxFolderConfiguration: vi.fn(() => mocks.configuration), saveWinamaxFolderConfiguration: mocks.saveConfiguration,
  deleteWinamaxFolderConfiguration: vi.fn(), getWinamaxScannedFile: mocks.getRecord, getWinamaxScannedFiles: mocks.getRecords, saveWinamaxScannedFiles: mocks.saveRecords,
} }));
vi.mock('../../features/winamax/previewWinamaxFiles', () => ({ previewWinamaxFiles: mocks.preview }));
vi.mock('../../features/winamax/toWinamaxOperationImports', () => ({ toWinamaxOperationImports: () => [] }));

import { createWinamaxFolderService, winamaxFolderService } from './winamaxFolderService';

const file = (name: string, content = 'x', lastModified = 1): File => new File([content], name, { lastModified });
const preview = (entries: unknown[] = []) => ({ files: [], entries, entrySourceFileNames: entries.map(() => []), invalidFileNames: [] });

describe('winamaxFolderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuration = { directoryHandle: { name: 'Winamax' } as FileSystemDirectoryHandle, directoryName: 'Winamax', selectedAt: '2026-07-30T00:00:00.000Z', autoScanEnabled: false };
    mocks.permission = 'granted'; mocks.requestedPermission = 'granted'; mocks.files = []; mocks.records.clear();
    mocks.getPermission.mockImplementation(async () => mocks.permission); mocks.requestPermission.mockImplementation(async () => mocks.requestedPermission);
    mocks.readFolder.mockImplementation(async () => mocks.files); mocks.preview.mockImplementation(async () => preview());
    mocks.getRecord.mockImplementation(async (fingerprint: string) => mocks.records.get(fingerprint)); mocks.getRecords.mockImplementation(async () => [...mocks.records.values()]);
    mocks.saveRecords.mockImplementation(async (records: { fingerprint: string; status: string }[]) => records.forEach((record) => mocks.records.set(record.fingerprint, record)));
    mocks.saveConfiguration.mockResolvedValue(undefined);
  });

  it('reads immediately when permission is granted, including automatic scans', async () => {
    mocks.files = [{ relativeName: 'a/history.txt', file: file('history.txt') }];
    await winamaxFolderService.scan(false);
    expect(mocks.getPermission).toHaveBeenCalledOnce(); expect(mocks.requestPermission).not.toHaveBeenCalled(); expect(mocks.readFolder).toHaveBeenCalledOnce(); expect(mocks.preview).toHaveBeenCalledOnce();
  });

  it.each(['prompt', 'denied'] as PermissionState[])('does not request or read automatically when permission is %s', async (permission) => {
    mocks.permission = permission;
    await expect(winamaxFolderService.scan(false)).rejects.toThrow();
    expect(mocks.requestPermission).not.toHaveBeenCalled(); expect(mocks.readFolder).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('requests permission only for a manual scan and stops when it is refused', async () => {
    mocks.permission = 'prompt'; mocks.requestedPermission = 'denied';
    await expect(winamaxFolderService.scan()).rejects.toThrow();
    expect(mocks.requestPermission).toHaveBeenCalledOnce(); expect(mocks.readFolder).not.toHaveBeenCalled();
  });

  it('continues a manual scan after the user grants permission', async () => {
    mocks.permission = 'prompt'; mocks.requestedPermission = 'granted';
    await winamaxFolderService.scan();
    expect(mocks.requestPermission).toHaveBeenCalledOnce(); expect(mocks.readFolder).toHaveBeenCalledOnce();
  });

  it('reprocesses changed fingerprints and keeps same file names in separate folders distinct', async () => {
    mocks.files = [{ relativeName: 'one/history.txt', file: file('history.txt', 'x', 1) }, { relativeName: 'two/history.txt', file: file('history.txt', 'xx', 2) }];
    await winamaxFolderService.scan();
    expect(mocks.preview).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'history.txt' })]));
    expect(mocks.saveRecords.mock.calls[0][0]).toHaveLength(2);
  });

  it('marks orphan tournament sources incomplete rather than invalid', async () => {
    mocks.files = [{ relativeName: 'history.txt', file: file('history.txt') }];
    const entry = { kind: 'tournament', tournamentId: '1', playerName: 'Hero', status: 'error' };
    mocks.preview.mockResolvedValue({ ...preview([entry]), entrySourceFileNames: [['history.txt']] });
    await winamaxFolderService.scan();
    expect(mocks.saveRecords.mock.calls[0][0][0]).toMatchObject({ status: 'incomplete' });
  });

  it('uses the preloaded observable registry and exposes service writes', async () => {
    const existing = { fingerprint: 'old|1|1', status: 'detected' }; mocks.records.set(existing.fingerprint, existing);
    mocks.files = [{ relativeName: 'new/history.txt', file: file('history.txt') }];
    await winamaxFolderService.scan();
    expect(mocks.getRecords).toHaveBeenCalledOnce();
    expect(mocks.saveRecords).toHaveBeenCalledOnce();
    expect(mocks.records.get('new/history.txt|1|1')).toMatchObject({ status: 'detected' });
  });

  it('starts each test with an empty registry harness', () => {
    expect(mocks.records).toEqual(new Map());
    expect(mocks.getRecord).not.toHaveBeenCalled(); expect(mocks.saveRecords).not.toHaveBeenCalled();
  });

  it('creates isolated instances with no residual scan promise', async () => {
    const first = createWinamaxFolderService(); const second = createWinamaxFolderService();
    await first.scan(); await second.scan();
    expect(mocks.readFolder).toHaveBeenCalledTimes(2);
  });

  it('does not read, parse, or rewrite an unchanged imported file', async () => {
    const entry = { relativeName: 'archive/history.txt', file: file('history.txt', 'x', 10) };
    const fingerprint = 'archive/history.txt|1|10'; mocks.files = [entry]; mocks.records.set(fingerprint, { fingerprint, status: 'imported' });
    const service = createWinamaxFolderService();
    const result = await service.scan();
    expect(result.preview.entries).toEqual([]); expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.saveRecords).not.toHaveBeenCalled();
    expect(mocks.records.get(fingerprint)).toMatchObject({ status: 'imported' });
  });

  it('does not read, parse, or rewrite an unchanged duplicate file', async () => {
    const entry = { relativeName: 'archive/history.txt', file: file('history.txt', 'x', 10) };
    const fingerprint = 'archive/history.txt|1|10'; mocks.files = [entry]; mocks.records.set(fingerprint, { fingerprint, status: 'duplicate' });
    const service = createWinamaxFolderService();
    const result = await service.scan();
    expect(result.preview.entries).toEqual([]); expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.saveRecords).not.toHaveBeenCalled();
    expect(mocks.records.get(fingerprint)).toMatchObject({ status: 'duplicate' });
  });

  it('reprocesses a finalized file when only its size changes', async () => {
    const entry = { relativeName: 'archive/history.txt', file: file('history.txt', 'updated', 10) };
    const oldFingerprint = 'archive/history.txt|3|10'; const currentFingerprint = 'archive/history.txt|7|10';
    mocks.files = [entry]; mocks.records.set(oldFingerprint, { fingerprint: oldFingerprint, status: 'imported' });
    const result = await createWinamaxFolderService().scan();
    expect(currentFingerprint).not.toBe(oldFingerprint); expect(mocks.preview).toHaveBeenCalledWith([entry.file]); expect(mocks.saveRecords).toHaveBeenCalledOnce();
    expect(mocks.records.get(currentFingerprint)).toMatchObject({ status: 'detected' }); expect(result.preview.entries).toEqual([]);
  });

  it('reprocesses a finalized file when only its lastModified changes', async () => {
    const entry = { relativeName: 'archive/history.txt', file: file('history.txt', 'updated', 20) };
    const oldFingerprint = 'archive/history.txt|7|10'; const currentFingerprint = 'archive/history.txt|7|20';
    mocks.files = [entry]; mocks.records.set(oldFingerprint, { fingerprint: oldFingerprint, status: 'imported' });
    const result = await createWinamaxFolderService().scan();
    expect(currentFingerprint).not.toBe(oldFingerprint); expect(mocks.preview).toHaveBeenCalledWith([entry.file]); expect(mocks.saveRecords).toHaveBeenCalledOnce();
    expect(mocks.records.get(currentFingerprint)).toMatchObject({ status: 'detected' }); expect(result.preview.entries).toEqual([]);
  });

  it('re-evaluates an incomplete history when its summary appears later', async () => {
    const history = { relativeName: 'tournament.txt', file: file('tournament.txt', 'history', 1) };
    const summary = { relativeName: 'tournament_summary.txt', file: file('tournament_summary.txt', 'summary', 2) };
    const incomplete = { kind: 'tournament', tournamentId: '42', playerName: 'Hero', status: 'error' };
    const importable = { ...incomplete, status: 'valid' };
    mocks.files = [history]; mocks.preview.mockResolvedValueOnce({ ...preview([incomplete]), entrySourceFileNames: [['tournament.txt']] });
    const service = createWinamaxFolderService(); const first = await service.scan();
    expect(first.preview.entries).toEqual([incomplete]); expect(mocks.records.get('tournament.txt|7|1')).toMatchObject({ status: 'incomplete' });
    mocks.files = [history, summary]; mocks.preview.mockResolvedValueOnce({ ...preview([importable]), entrySourceFileNames: [['tournament.txt', 'tournament_summary.txt']] });
    const second = await service.scan();
    expect(second.preview.entries).toEqual([importable]); expect(mocks.records.get('tournament.txt|7|1')).toMatchObject({ status: 'importable' }); expect(mocks.records.get('tournament_summary.txt|7|2')).toMatchObject({ status: 'importable' });
  });

  it('re-evaluates an incomplete summary when its history appears later', async () => {
    const summary = { relativeName: 'tournament_summary.txt', file: file('tournament_summary.txt', 'summary', 2) };
    const history = { relativeName: 'tournament.txt', file: file('tournament.txt', 'history', 1) };
    const incomplete = { kind: 'tournament', tournamentId: '42', playerName: 'Hero', status: 'error' };
    const importable = { ...incomplete, status: 'valid' };
    mocks.files = [summary]; mocks.preview.mockResolvedValueOnce({ ...preview([incomplete]), entrySourceFileNames: [['tournament_summary.txt']] });
    const service = createWinamaxFolderService(); await service.scan();
    expect(mocks.records.get('tournament_summary.txt|7|2')).toMatchObject({ status: 'incomplete' });
    mocks.files = [summary, history]; mocks.preview.mockResolvedValueOnce({ ...preview([importable]), entrySourceFileNames: [['tournament_summary.txt', 'tournament.txt']] });
    const second = await service.scan();
    expect(second.preview.entries).toEqual([importable]); expect(mocks.records.get('tournament_summary.txt|7|2')).toMatchObject({ status: 'importable' }); expect(mocks.records.get('tournament.txt|7|1')).toMatchObject({ status: 'importable' });
  });

  it('mutualizes concurrent scans and releases activeScan after success', async () => {
    let resolveRead!: (files: { relativeName: string; file: File }[]) => void;
    mocks.readFolder.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    const service = createWinamaxFolderService(); const first = service.scan(); const second = service.scan();
    await Promise.resolve(); await Promise.resolve();
    expect(mocks.readFolder).toHaveBeenCalledOnce();
    resolveRead([]);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(secondResult); expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.saveRecords).not.toHaveBeenCalled();
    await service.scan(); expect(mocks.readFolder).toHaveBeenCalledTimes(2);
  });

  it('releases activeScan after a shared scan error and allows a later success', async () => {
    mocks.readFolder.mockRejectedValueOnce(new Error('lecture impossible'));
    const service = createWinamaxFolderService(); const first = service.scan(); const second = service.scan();
    await expect(Promise.all([first, second])).rejects.toThrow('lecture impossible');
    expect(mocks.readFolder).toHaveBeenCalledOnce(); expect(mocks.saveRecords).not.toHaveBeenCalled();
    await expect(service.scan()).resolves.toMatchObject({ preview: { entries: [] } });
    expect(mocks.readFolder).toHaveBeenCalledTimes(2);
  });

});
