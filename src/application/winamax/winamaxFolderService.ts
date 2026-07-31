import { previewWinamaxFiles, type WinamaxFilesPreview } from '../../features/winamax/previewWinamaxFiles';
import { bankrollDatabase } from '../../infrastructure/storage/bankrollDatabase';
import { getDirectoryPermission, requestDirectoryPermission, type WinamaxFolderConfiguration } from '../../infrastructure/filesystem/fileSystemAccessSupport';
import { readWinamaxFolder, type WinamaxFolderFile } from '../../infrastructure/filesystem/winamaxFolderGateway';
import { fingerprintWinamaxFile } from '../../infrastructure/filesystem/winamaxFolderGateway';
import { toWinamaxOperationImports } from '../../features/winamax/toWinamaxOperationImports';
import { winamaxScannedFileStatus, type WinamaxScannedFileRecord } from '../../domain/winamax/winamaxScannedFile';

export interface WinamaxFolderScan {
  configuration: WinamaxFolderConfiguration;
  preview: WinamaxFilesPreview;
  fileNames: string[];
  sourceFingerprintsByImportKey: Record<string, string[]>;
}

const groupKeyFor = (entry: WinamaxFilesPreview['entries'][number]): string | undefined => entry.kind === 'tournament' && entry.tournamentId !== undefined && entry.playerName !== undefined ? `${entry.tournamentId}:${entry.playerName.trim().toLocaleLowerCase()}` : undefined;

export const createWinamaxFolderService = () => {
  let activeScan: Promise<WinamaxFolderScan> | undefined;
  return {
  getConfiguration: (): Promise<WinamaxFolderConfiguration | undefined> => bankrollDatabase.getWinamaxFolderConfiguration(),
  saveConfiguration: (configuration: WinamaxFolderConfiguration): Promise<void> => bankrollDatabase.saveWinamaxFolderConfiguration(configuration),
  forget: (): Promise<void> => bankrollDatabase.deleteWinamaxFolderConfiguration(),
  scan: (allowPermissionPrompt = true): Promise<WinamaxFolderScan> => {
    if (activeScan !== undefined) return activeScan;
    activeScan = (async (): Promise<WinamaxFolderScan> => {
    const configuration = await bankrollDatabase.getWinamaxFolderConfiguration();
    if (configuration === undefined) throw new Error('Aucun dossier Winamax n’est configuré.');
    const permission = await getDirectoryPermission(configuration.directoryHandle);
    if (permission !== 'granted' && (!allowPermissionPrompt || await requestDirectoryPermission(configuration.directoryHandle) !== 'granted')) throw new Error('L’autorisation de lecture du dossier Winamax a été refusée.');
    const files = await readWinamaxFolder(configuration.directoryHandle);
    const now = new Date().toISOString();
    const recordsBefore = await bankrollDatabase.getWinamaxScannedFiles();
    const unseen: WinamaxFolderFile[] = [];
    for (const entry of files) {
      const fingerprint = fingerprintWinamaxFile(entry.file, entry.relativeName);
      const previous = await bankrollDatabase.getWinamaxScannedFile(fingerprint);
      if (previous?.status === 'imported' || previous?.status === 'duplicate') continue;
      unseen.push(entry);
    }
    let preview: WinamaxFilesPreview = unseen.length === 0 ? { files: [], entries: [], entrySourceFileNames: [], invalidFileNames: [] } : await previewWinamaxFiles(unseen.map(({ file }) => file));
    // A changed member of an already completed pair must be re-evaluated with its
    // unchanged partner, but unrelated imported files stay unread.
    const discoveredGroups = new Set(preview.entries.map(groupKeyFor).filter((value): value is string => value !== undefined));
    const partnerNames = new Set(recordsBefore.filter((record) => record.groupKey !== undefined && discoveredGroups.has(record.groupKey) && (record.status === 'imported' || record.status === 'duplicate')).map((record) => record.fileName));
    const partners = files.filter(({ relativeName }) => partnerNames.has(relativeName) && !unseen.some((entry) => entry.relativeName === relativeName));
    if (partners.length > 0) { unseen.push(...partners); preview = await previewWinamaxFiles(unseen.map(({ file }) => file)); }
    const sourceFingerprintsByName = new Map(unseen.map(({ file, relativeName }) => [file.name, fingerprintWinamaxFile(file, relativeName)]));
    const statusesByName = new Map<string, WinamaxScannedFileRecord['status']>();
    const groupByName = new Map<string, string>();
    preview.entries.forEach((entry, index) => {
      const sourceNames = preview.entrySourceFileNames[index] ?? [];
      const status = winamaxScannedFileStatus({ hasParseError: false, isIncomplete: entry.status === 'error', isImportable: entry.status !== 'error' });
      const groupKey = groupKeyFor(entry);
      sourceNames.forEach((name) => { statusesByName.set(name, status); if (groupKey !== undefined) groupByName.set(name, groupKey); });
    });
    const records: WinamaxScannedFileRecord[] = unseen.map(({ file, relativeName }) => ({ fingerprint: fingerprintWinamaxFile(file, relativeName), fileName: relativeName, size: file.size, lastModified: file.lastModified, fileKind: /_summary\.txt$/i.test(file.name) ? 'summary' : /\.txt$/i.test(file.name) ? 'history' : 'unknown', status: statusesByName.get(file.name) ?? winamaxScannedFileStatus({ hasParseError: preview.invalidFileNames.includes(file.name), isIncomplete: false, isImportable: false }), groupKey: groupByName.get(file.name), firstSeenAt: now, lastSeenAt: now }));
    if (records.length > 0) await bankrollDatabase.saveWinamaxScannedFiles(records);
    const sourceFingerprintsByImportKey: Record<string, string[]> = {};
    preview.entries.forEach((entry, index) => {
      const item = toWinamaxOperationImports([entry])[0];
      if (item !== undefined) sourceFingerprintsByImportKey[item.importKey] = (preview.entrySourceFileNames[index] ?? []).map((name) => sourceFingerprintsByName.get(name)).filter((value): value is string => value !== undefined);
    });
    const updated = { ...configuration, lastScanAt: now };
    await bankrollDatabase.saveWinamaxFolderConfiguration(updated);
    return { configuration: updated, preview, fileNames: files.map(({ relativeName }) => relativeName), sourceFingerprintsByImportKey };
    })();
    return activeScan.finally(() => { activeScan = undefined; });
  },
  };
};

export const winamaxFolderService = createWinamaxFolderService();
